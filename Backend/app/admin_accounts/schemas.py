from typing import Annotated, Literal
import re

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, field_validator, model_validator

Role = Literal["ADMIN", "THU_KHO", "KHACH_HANG"]
Status = Literal[0, 1, 2]  # Hidden, active, temporarily locked. Never delete history.
def safe_identifier(value: str) -> str:
    if value in {".", ".."}:
        raise ValueError("Mã không được là . hoặc ..")
    return value


Identifier = Annotated[str, Field(min_length=1, max_length=100, pattern=r"^[A-Za-z0-9_.-]+$"), AfterValidator(safe_identifier)]
Password = Annotated[str, Field(min_length=10, max_length=128, json_schema_extra={"writeOnly": True, "format": "password"})]
Username = Annotated[str, Field(min_length=3, max_length=80, pattern=r"^[A-Za-z0-9_.-]+$")]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")

    @field_validator("ma_tk", "ten_tai_khoan", "ma_nhan_vien", "ma_kh", check_fields=False, mode="before")
    @classmethod
    def trim_identifier(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("email", check_fields=False)
    @classmethod
    def email_address(cls, value):
        if value is None:
            return None
        value = value.strip().lower()
        if len(value) > 254 or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Email không đúng định dạng.")
        return value


class AccountCreate(Input):
    ma_tk: Identifier
    ten_tai_khoan: Username
    email: str | None = None
    ma_nhan_vien: Identifier | None = None
    ma_kh: Identifier | None = None
    password: Password

    @field_validator("ma_tk")
    @classmethod
    def reserved_route(cls, value):
        if value == "new":
            raise ValueError("Mã new được dành cho trang tạo tài khoản.")
        return value

    @model_validator(mode="after")
    def exactly_one_owner(self):
        if bool(self.ma_nhan_vien) == bool(self.ma_kh):
            raise ValueError("Chọn đúng một nhân viên hoặc một khách hàng.")
        return self

class AccountUpdate(Input):
    ten_tai_khoan: Username | None = None
    email: str | None = None

    @model_validator(mode="after")
    def nonempty_patch(self):
        if not self.model_fields_set:
            raise ValueError("Chưa có thay đổi.")
        if "ten_tai_khoan" in self.model_fields_set and self.ten_tai_khoan is None:
            raise ValueError("Tên tài khoản không được để trống.")
        return self


class StatusUpdate(Input):
    trang_thai: Status

    @field_validator("trang_thai", mode="before")
    @classmethod
    def integer_status(cls, value):
        if type(value) is not int:
            raise ValueError("Trạng thái phải là số nguyên 0, 1 hoặc 2.")
        return value


class PasswordReset(BaseModel):
    model_config = ConfigDict(extra="forbid")
    password: Password


class PasswordChange(PasswordReset):
    current_password: Annotated[str, Field(min_length=1, max_length=128, json_schema_extra={"writeOnly": True, "format": "password"})]


class RoleUpdate(Input):
    role: Literal["ADMIN", "THU_KHO"]
    ma_kho: Annotated[int, Field(strict=True, gt=0)] | None = None

    @model_validator(mode="after")
    def warehouse_assignment(self):
        if (self.role == "ADMIN") != (self.ma_kho is None):
            raise ValueError("ADMIN không gán kho; THU_KHO phải chọn một kho.")
        return self


class AccountRead(BaseModel):
    ma_tk: str
    ten_tai_khoan: str
    email: str | None
    ma_nhan_vien: str | None
    ma_kh: str | None
    trang_thai: Status
    role: Role
    ho_ten: str
    ma_kho: int | None
    owner_active: bool
    is_self: bool


class AccountPage(BaseModel):
    data: list[AccountRead]
    total: int
    page: int
    page_size: int


class OwnerRead(BaseModel):
    id: str
    name: str
    role: Role
    ma_kho: int | None = None
    has_account: bool


class OwnerPage(BaseModel):
    data: list[OwnerRead]
    total: int
    page: int
    page_size: int
