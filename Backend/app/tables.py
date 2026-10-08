"""Authenticated table reads and validated master-data writes.

Inventory/financial documents deliberately have no generic writes: their future
workflow endpoints must execute one PostgreSQL transaction, not several HTTP calls.
"""
import json
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import ValidationError

from .auth import User, check_origin, current_user, passwords
from .resources import ENUMS, RESOURCES, SYSTEM_FIELDS, ResourceName, payload_model, public_columns
from .supabase import get_supabase
from .api_contracts import READ_ERRORS, WRITE_ERRORS, ResourceMetadata, error_response

router = APIRouter(prefix="/api/data", tags=["Tables"])
CUSTOMER_READ = {"customers", "orders", "order-lines", "invoices", "payments", "voucher-uses"}
CUSTOMER_CHILDREN = {"order-lines", "invoices", "payments", "voucher-uses"}


def can_write(name: str, user: User) -> bool:
    return RESOURCES[name].writable and (user.role == "ADMIN" or (user.role == "THU_KHO" and name == "suppliers"))


def access(name: str, user: User, write: bool = False) -> None:
    readable = user.role == "ADMIN" or (user.role == "THU_KHO" and RESOURCES[name].warehouse) or (user.role == "KHACH_HANG" and name in CUSTOMER_READ)
    if not readable or (write and not can_write(name, user)):
        raise HTTPException(403, "Bạn không có quyền thực hiện thao tác này.")


@router.get("/resources", summary="Danh mục bảng và trường mà role hiện tại được sử dụng",
            response_model=list[ResourceMetadata], responses=READ_ERRORS)
def resources(response: Response, user: User = Depends(current_user)):
    response.headers["Cache-Control"] = "no-store"
    result = []
    for name, resource in RESOURCES.items():
        try:
            access(name, user)
        except HTTPException:
            continue
        columns = public_columns(name)
        result.append({"name": name, "table": resource.table, "title": resource.title, "keys": resource.keys,
                       "columns": [{**column, "choices": ENUMS.get((name, column["name"])),
                                    "immutable": column["name"] in resource.keys or (name == "products" and column["name"] == "sku")}
                                   | {"system": column["name"] in SYSTEM_FIELDS.get(name, set())} for column in columns],
                       "writable": can_write(name, user),
                       "create_schema": payload_model(name, False).model_json_schema() if can_write(name, user) else None})
    return result


def selected_columns(name: str, user: User) -> str:
    # Explicit fields: password hashes must never leave the server. Money is text
    # to avoid JavaScript rounding decimal(18,2) values.
    parts = [c["name"] + ("::text" if c["type"].startswith("decimal") else "") for c in public_columns(name)]
    if user.role == "KHACH_HANG" and name in CUSTOMER_CHILDREN:
        parts.append("scope:DON_HANG!inner(ma_kh)")
    if user.role == "THU_KHO" and name == "receipt-lines":
        parts.append("scope:PHIEU_NHAP!inner(ma_kho)")
    if user.role == "THU_KHO" and name == "transfer-lines":
        parts.append("scope:PHIEU_CHUYEN_KHO!inner(ma_kho_xuat,ma_kho_nhan)")
    return ",".join(parts)


def scoped_query(name: str, user: User, db, search: str | None = None):
    query = db.table(RESOURCES[name].table).select(selected_columns(name, user), count="exact")
    if user.role == "KHACH_HANG":
        query = query.eq("scope.ma_kh" if name in CUSTOMER_CHILDREN else "ma_kh", user.customer_id)
    if user.role == "THU_KHO":
        if name in {"warehouses", "inventory", "receipts"}:
            query = query.eq("ma_kho", user.warehouse_id)
        elif name == "receipt-lines":
            query = query.eq("scope.ma_kho", user.warehouse_id)
        elif name in {"transfers", "transfer-lines"}:
            clause = f"ma_kho_xuat.eq.{user.warehouse_id},ma_kho_nhan.eq.{user.warehouse_id}"
            if name == "transfers" and search:
                clause = f"and(or({clause}),or({search}))"
            query = query.or_(clause, reference_table="scope") if name == "transfer-lines" else query.or_(clause)
    # Exactly one top-level OR parameter. Never merge permission and text OR
    # with duplicate query parameters (PostgREST versions may interpret them differently).
    if search and not (user.role == "THU_KHO" and name == "transfers"):
        query = query.or_(search)
    return query


def key_values(name: str, key: str) -> list:
    try:
        values = json.loads(key)
        if not isinstance(values, list) or len(values) != len(RESOURCES[name].keys):
            raise ValueError
        for field, value in zip(RESOURCES[name].keys, values):
            kind = next(c["type"] for c in public_columns(name) if c["name"] == field)
            if kind == "int":
                if type(value) is not int or value < 1:
                    raise ValueError
            elif not isinstance(value, str) or not 1 <= len(value) <= 2000:
                raise ValueError
        return values
    except (ValueError, TypeError):
        raise HTTPException(422, "key phải là mảng JSON các khóa chính theo đúng thứ tự và kiểu dữ liệu.") from None


def apply_keys(query, name: str, values: list):
    for field, value in zip(RESOURCES[name].keys, values):
        query = query.eq(field, value)
    return query


def clean(rows: list[dict]) -> list[dict]:
    return [{key: value for key, value in row.items() if key not in {"scope", "mat_khau_hash"}} for row in rows]


@router.get("/{resource}", responses=READ_ERRORS)
def read_rows(resource: ResourceName, response: Response, page: int = Query(1, ge=1),
              page_size: int = Query(20, ge=1, le=100), q: str = Query("", max_length=100),
              key: str | None = Query(None, max_length=6000), user: User = Depends(current_user), db=Depends(get_supabase)):
    name = resource.value
    access(name, user)
    search = None
    if q.strip():
        # imatch regex literal, JSON quoted to prevent PostgREST filter injection.
        pattern = json.dumps(re.escape(q.strip()), ensure_ascii=False)
        fields = [c["name"] for c in public_columns(name) if c["type"] == "varchar"]
        if fields:
            search = ",".join(f"{field}.imatch.{pattern}" for field in fields)
    query = scoped_query(name, user, db, search)
    if key is not None:
        query = apply_keys(query, name, key_values(name, key))
    for field in RESOURCES[name].keys:
        query = query.order(field)
    result = query.range((page - 1) * page_size, page * page_size - 1).execute()
    response.headers["Cache-Control"] = "no-store"
    return {"data": clean(result.data), "total": result.count or 0, "page": page, "page_size": page_size}


async def read_payload(request: Request, name: str, patch: bool) -> dict:
    try:
        body = await request.json()
        model = payload_model(name, patch).model_validate(body)
    except (ValueError, ValidationError) as exc:
        if isinstance(exc, ValidationError):
            detail = [{"loc": list(e["loc"]), "msg": e["msg"]} for e in exc.errors()]
        else:
            detail = "Body phải là JSON hợp lệ."
        raise HTTPException(422, detail) from None
    data = model.model_dump(mode="json", exclude_unset=patch)
    if not data:
        raise HTTPException(422, "Không có trường cần cập nhật.")
    for field, value in data.items():
        choices = ENUMS.get((name, field))
        if choices and value not in choices:
            raise HTTPException(422, f"{field}: chọn một trong {', '.join(choices)}.")
        if field == "trang_thai" and isinstance(value, int) and value not in {0, 1, 2}:
            raise HTTPException(422, "trang_thai chỉ nhận 0, 1 hoặc 2.")
        if isinstance(value, str) and not value.strip():
            raise HTTPException(422, f"{field} không được để trống.")
    if name == "vouchers" and "ma_code" in data:
        data["ma_code"] = data["ma_code"].strip().upper()
    return data


def validate_combined(name: str, data: dict, user: User) -> None:
    if name == "accounts" and bool(data.get("ma_kh")) == bool(data.get("ma_nhan_vien")):
        raise HTTPException(422, "Tài khoản phải thuộc đúng một khách hàng hoặc một nhân viên.")
    if name == "employees":
        if (data["loai_nhan_vien"] == "ADMIN") != (data.get("ma_kho") is None):
            raise HTTPException(422, "ADMIN không gán kho; THU_KHO phải gán một kho.")
    if name == "promotions":
        try:
            valid = datetime.fromisoformat(data["ngay_ket_thuc"]) > datetime.fromisoformat(data["ngay_bat_dau"])
        except (ValueError, TypeError):
            valid = False
        if not valid:
            raise HTTPException(422, "Ngày kết thúc phải sau ngày bắt đầu và cùng kiểu múi giờ.")
    if name == "vouchers":
        percentage = data["loai_giam"] == "PHAN_TRAM"
        if float(data["gia_tri_giam"]) <= 0 or (percentage and float(data["gia_tri_giam"]) > 100):
            raise HTTPException(422, "Giá trị giảm phải dương; phần trăm không quá 100.")
        maximum = data.get("giam_toi_da")
        if maximum is not None and (not percentage or float(maximum) <= 0):
            raise HTTPException(422, "Trần giảm chỉ dùng cho voucher phần trăm và phải dương.")


def private_payload(data: dict) -> dict:
    if "password" in data:
        data["mat_khau_hash"] = passwords.hash(data.pop("password"))
    return data


@router.post("/{resource}", status_code=201, responses=WRITE_ERRORS)
async def create_row(resource: ResourceName, request: Request, response: Response,
                     user: User = Depends(current_user), db=Depends(get_supabase)):
    name = resource.value
    check_origin(request)
    access(name, user, write=True)
    data = await read_payload(request, name, False)
    if name == "promotions":
        data["nguoi_tao"] = user.employee_id
    if name in {"promotions", "vouchers"}:
        data["ngay_tao"] = datetime.now(timezone.utc).isoformat()
    validate_combined(name, data, user)
    result = db.table(RESOURCES[name].table).insert(private_payload(data)).execute()
    response.headers["Cache-Control"] = "no-store"
    return {"data": clean(result.data)}


@router.patch("/{resource}", responses={**WRITE_ERRORS, 404: error_response(404, "Bản ghi không tồn tại.")})
async def update_row(resource: ResourceName, request: Request, response: Response, key: str = Query(..., max_length=6000),
                     user: User = Depends(current_user), db=Depends(get_supabase)):
    name = resource.value
    check_origin(request)
    access(name, user, write=True)
    keys = key_values(name, key)
    existing = apply_keys(scoped_query(name, user, db), name, keys).limit(1).execute().data
    if not existing:
        raise HTTPException(404, "Không tìm thấy dữ liệu.")
    data = await read_payload(request, name, True)
    if name == "employees" and keys == [user.employee_id]:
        if data.get("loai_nhan_vien", "ADMIN") != "ADMIN" or data.get("trang_thai", 1) != 1 or data.get("ma_kho") is not None:
            raise HTTPException(409, "Không được vô hiệu hóa hoặc hạ quyền nhân viên đang đăng nhập.")
    if name == "promotions" and any(field in data for field in ["nguoi_tao", "ngay_tao"]):
        raise HTTPException(422, "Không được sửa người tạo hoặc ngày tạo.")
    validate_combined(name, {**existing[0], **data}, user)
    result = apply_keys(db.table(RESOURCES[name].table).update(private_payload(data)), name, keys).execute()
    if not result.data:
        raise HTTPException(404, "Không tìm thấy dữ liệu.")
    response.headers["Cache-Control"] = "no-store"
    return {"data": clean(result.data)}
