import json
import re
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Query, Request, Response

from app.models.user import User
from app.dependencies.origin import check_origin
from app.dependencies.auth import current_user
from app.models.resources import CUSTOMER_CHILDREN, ENUMS, RESOURCES, SYSTEM_FIELDS, ResourceName, payload_model, public_columns
from app.config.database import get_supabase
from app.repositories.tables import apply_keys, clean, scoped_query
from app.services.tables import access, can_write, key_values, private_payload, read_payload, validate_combined


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


def read_rows(resource: ResourceName, response: Response, page: int = Query(1, ge=1),
              page_size: int = Query(20, ge=1, le=100), q: str = Query("", max_length=100),
              key: str | None = Query(None, max_length=6000),
              order_id: str | None = Query(None, min_length=1, max_length=100),
              user: User = Depends(current_user), db=Depends(get_supabase)):
    name = resource.value
    access(name, user)
    if order_id is not None and (name not in {"orders", *CUSTOMER_CHILDREN} or not order_id.strip()):
        raise HTTPException(422, "order_id chỉ dùng để lọc đơn hàng và các bảng liên quan đến đơn hàng.")
    search = None
    if q.strip():
        pattern = json.dumps(re.escape(q.strip()), ensure_ascii=False)
        fields = [c["name"] for c in public_columns(name) if c["type"] == "varchar"]
        if fields:
            search = ",".join(f"{field}.imatch.{pattern}" for field in fields)
    query = scoped_query(name, user, db, search)
    if order_id is not None:
        query = query.eq("ma_donhang", order_id)
    if key is not None:
        query = apply_keys(query, name, key_values(name, key))
    for field in RESOURCES[name].keys:
        query = query.order(field)
    result = query.range((page - 1) * page_size, page * page_size - 1).execute()
    response.headers["Cache-Control"] = "no-store"
    body = {"data": clean(result.data), "total": result.count or 0, "page": page, "page_size": page_size}
    if order_id is not None:
        body["order_id"] = order_id
    return body


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
