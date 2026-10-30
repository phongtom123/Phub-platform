from datetime import date, datetime, timedelta, timezone
import json
import re

from fastapi import HTTPException
from pydantic import ValidationError

from phub_api.models.resources import (
    CUSTOMER_CHILDREN,
    CUSTOMER_READ,
    ENUMS,
    RESOURCES,
    SYSTEM_FIELDS,
    public_columns,
)
from phub_api.models.user import User
from phub_api.repositories.tables import TablesRepository, clean
from phub_api.schemas.resources import payload_model
from phub_api.schemas.crm import vietnam_today
from phub_api.schemas.warehouse_drafts import DRAFT_FIELDS
from phub_api.config.warehouse import OPERATING_WAREHOUSE_ID, WAREHOUSE_SCOPE_MESSAGE
from phub_api.services.warehouse_scope import require_operating_warehouse


def can_write(name: str, user: User) -> bool:
    if name == 'warehouses':
        return False  # One fixed warehouse; archived warehouse records remain in the DB.
    return RESOURCES[name].writable and (user.role == "ADMIN" or (user.role == "NHAN_VIEN" and name == "suppliers"))


def access(name: str, user: User, write: bool = False) -> None:
    if user.role == 'NHAN_VIEN' and user.warehouse_id != OPERATING_WAREHOUSE_ID:
        raise HTTPException(403, WAREHOUSE_SCOPE_MESSAGE)
    readable = user.role == "ADMIN" or (user.role == "NHAN_VIEN" and RESOURCES[name].warehouse) or (user.role == "KHACH_HANG" and name in CUSTOMER_READ)
    if not readable or (write and not can_write(name, user)):
        raise HTTPException(403, "Bạn không có quyền thực hiện thao tác này.")


def key_values(name: str, key: str) -> list:
    try:
        values = json.loads(key)
        if not isinstance(values, list) or len(values) != len(RESOURCES[name].keys):
            raise ValueError
        for field, value in zip(RESOURCES[name].keys, values):
            kind = next(c["type"] for c in public_columns(name) if c["name"] == field)
            if kind == "int":
                if type(value) is not int or not -(2**31) <= value <= 2**31 - 1:
                    raise ValueError
            elif not isinstance(value, str) or not 1 <= len(value) <= 2000:
                raise ValueError
        return values
    except (ValueError, TypeError):
        raise HTTPException(422, "key phải là mảng JSON các khóa chính theo đúng thứ tự và kiểu dữ liệu.") from None


def read_payload(body, name: str, patch: bool) -> dict:
    try:
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
    if name == "customers" and data.get("ngay_sinh") and data["ngay_sinh"] > vietnam_today().isoformat():
        raise HTTPException(422, "Ngày sinh không được ở tương lai.")
    return data


def validate_combined(name: str, data: dict, user: User) -> None:
    if name == "accounts" and bool(data.get("ma_kh")) == bool(data.get("ma_nhan_vien")):
        raise HTTPException(422, "Tài khoản phải thuộc đúng một khách hàng hoặc một nhân viên.")
    if name == "employees":
        if (data["loai_nhan_vien"] == "ADMIN") != (data.get("ma_kho") is None):
            raise HTTPException(422, "ADMIN không gán kho; NHAN_VIEN phải gán một kho.")
        if data['loai_nhan_vien'] == 'NHAN_VIEN':
            require_operating_warehouse(data.get('ma_kho'))
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
        data["mat_khau"] = data.pop("password")
    return data


def resource_metadata(user: User):
    result = []
    for name, resource in RESOURCES.items():
        try:
            access(name, user)
        except HTTPException:
            continue
        result.append({"name": name, "table": resource.table, "title": resource.title, "keys": resource.keys,
                       "columns": [{**column, "choices": ENUMS.get((name, column["name"])),
                                    "immutable": column["name"] in resource.keys or (name == "products" and column["name"] == "sku")}
                                   | {"system": column["name"] in SYSTEM_FIELDS.get(name, set())} for column in public_columns(name)],
                       "writable": can_write(name, user),
                       "draft_update_path": f"/api/admin/warehouse-drafts/{name}" if name in DRAFT_FIELDS and user.role == "ADMIN" and user.employee_id else None,
                       "draft_update_fields": DRAFT_FIELDS[name] if name in DRAFT_FIELDS and user.role == "ADMIN" and user.employee_id else None,
                       "create_schema": payload_model(name, False).model_json_schema() if can_write(name, user) else None})
    return result


def table_filters(name: str, raw: str | None):
    if not raw:
        return []
    try:
        values = json.loads(raw)
        if not isinstance(values, dict) or len(values) > 12:
            raise ValueError
        columns = {column['name']: column for column in public_columns(name)}
        result = []
        for key, value in values.items():
            if value in ('', None):
                continue
            field, _, suffix = key.partition('__')
            if field not in columns or suffix not in {'', 'from', 'to'} or isinstance(value, (list, dict, bool)):
                raise ValueError
            kind = columns[field]['type']
            if suffix:
                if kind not in {'date', 'datetime', 'timestamptz'}:
                    raise ValueError
                day = date.fromisoformat(str(value))
                if suffix == 'to':
                    day += timedelta(days=1)
                value = day.isoformat() if kind == 'date' else datetime.combine(day, datetime.min.time(), timezone(timedelta(hours=7))).astimezone(timezone.utc).isoformat()
                result.append((field, 'gte' if suffix == 'from' else 'lt', value))
            else:
                if kind == 'int':
                    if not (type(value) is int or isinstance(value, str) and re.fullmatch(r'-?\d+', value)):
                        raise ValueError
                    value = int(value)
                    if not -(2**31) <= value < 2**31:
                        raise ValueError
                elif not isinstance(value, str) or len(value) > 200:
                    raise ValueError
                result.append((field, 'eq', value))
        return result
    except (ValueError, TypeError, OverflowError):
        raise HTTPException(422, 'Bộ lọc không hợp lệ. Chỉ lọc theo cột và kiểu dữ liệu được công bố.') from None


class TablesService:
    def __init__(self, repository: TablesRepository, user: User):
        self.repository, self.user = repository, user

    def read(self, name, page, page_size, q, key, order_id, filters=None):
        access(name, self.user)
        if order_id is not None and (name not in {"orders", *CUSTOMER_CHILDREN} or not order_id.strip()):
            raise HTTPException(422, "order_id chỉ dùng để lọc đơn hàng và các bảng liên quan đến đơn hàng.")
        keys = key_values(name, key) if key is not None else None
        selection = table_filters(name, filters)
        result = self.repository.page(name, self.user, page, page_size, q, keys, order_id, selection) if selection else self.repository.page(name, self.user, page, page_size, q, keys, order_id)
        body = {"data": clean(result.data), "total": result.count or 0, "page": page, "page_size": page_size}
        if filters:
            body['filters'] = json.loads(filters)
        if order_id is not None:
            body["order_id"] = order_id
        return body

    def create(self, name, body):
        access(name, self.user, write=True)
        data = read_payload(body, name, False)
        if name == "promotions":
            data["nguoi_tao"] = self.user.employee_id
        if name in {"promotions", "vouchers"}:
            data["ngay_tao"] = datetime.now(timezone.utc).isoformat()
        validate_combined(name, data, self.user)
        return {"data": clean(self.repository.insert(name, private_payload(data)))}

    def update(self, name, key, body):
        access(name, self.user, write=True)
        keys = key_values(name, key)
        existing = self.repository.detail(name, self.user, keys)
        if not existing:
            raise HTTPException(404, "Không tìm thấy dữ liệu.")
        data = read_payload(body, name, True)
        if name == "employees" and keys == [self.user.employee_id]:
            if data.get("loai_nhan_vien", "ADMIN") != "ADMIN" or data.get("trang_thai", 1) != 1 or data.get("ma_kho") is not None:
                raise HTTPException(409, "Không được vô hiệu hóa hoặc hạ quyền nhân viên đang đăng nhập.")
        if name == "promotions" and any(field in data for field in ["nguoi_tao", "ngay_tao"]):
            raise HTTPException(422, "Không được sửa người tạo hoặc ngày tạo.")
        validate_combined(name, {**existing[0], **data}, self.user)
        rows = self.repository.update(name, keys, private_payload(data))
        if not rows:
            raise HTTPException(404, "Không tìm thấy dữ liệu.")
        return {"data": clean(rows)}
