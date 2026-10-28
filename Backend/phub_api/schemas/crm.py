"""Explicit contracts for the admin customer profile; never expose password hashes."""
from datetime import date, datetime, timedelta, timezone
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator

Identifier = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]


def vietnam_today() -> date:
    return datetime.now(timezone(timedelta(hours=7))).date()


class CustomerUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ten_kh: str = Field(default=None, min_length=1, max_length=2000)
    sdt: str | None = Field(default=None, max_length=100)
    dia_chi_chi_tiet_md: str | None = Field(default=None, max_length=2000)
    tinh_thanh_md: str | None = Field(default=None, max_length=2000)
    xa_phuong_md: str | None = Field(default=None, max_length=2000)
    ngay_sinh: date | None = None

    @field_validator("ten_kh", "sdt", "dia_chi_chi_tiet_md", "tinh_thanh_md", "xa_phuong_md", mode="before")
    @classmethod
    def trim_text(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("ngay_sinh", mode="before")
    @classmethod
    def birthday(cls, value):
        if value is not None and (not isinstance(value, str) or len(value) != 10):
            raise ValueError("Ngày sinh phải có dạng YYYY-MM-DD hoặc null.")
        if value is not None and date.fromisoformat(value) > vietnam_today():
            raise ValueError("Ngày sinh không được ở tương lai.")
        return value

    @model_validator(mode="after")
    def nonempty_patch(self):
        if not self.model_fields_set:
            raise ValueError("Chưa có thay đổi.")
        return self


class CustomerProfile(BaseModel):
    ma_kh: str
    ten_kh: str
    sdt: str | None = None
    dia_chi_chi_tiet_md: str | None = None
    tinh_thanh_md: str | None = None
    xa_phuong_md: str | None = None
    ngay_sinh: date | None = None
    ngay_tao: datetime | None = None
    cap_nhat_luc: datetime | None = None
    luu_tru_luc: datetime | None = None


class CustomerAccount(BaseModel):
    ma_tk: str
    ten_tai_khoan: str
    email: str | None = None
    trang_thai: int


class CustomerDetail(BaseModel):
    profile: CustomerProfile
    account: CustomerAccount | None


class CustomerOrder(BaseModel):
    ma_donhang: str
    trang_thai: str
    kenh_ban: str
    thoi_gian_dat: datetime


class CustomerOrders(BaseModel):
    data: list[CustomerOrder]
    total: int
    page: int
    page_size: int
