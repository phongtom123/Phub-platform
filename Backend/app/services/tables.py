import json
from datetime import datetime

from fastapi import HTTPException, Request
from pydantic import ValidationError

from app.models.resources import CUSTOMER_READ, ENUMS, RESOURCES, payload_model, public_columns
from app.models.user import User
from app.services.auth import passwords


def can_write(name: str, user: User) -> bool:
    return RESOURCES[name].writable and (user.role == "ADMIN" or (user.role == "THU_KHO" and name == "suppliers"))


def access(name: str, user: User, write: bool = False) -> None:
    readable = user.role == "ADMIN" or (user.role == "THU_KHO" and RESOURCES[name].warehouse) or (user.role == "KHACH_HANG" and name in CUSTOMER_READ)
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
