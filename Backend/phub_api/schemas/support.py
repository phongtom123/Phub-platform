from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

TicketStatus = Literal['MOI', 'DANG_XU_LY', 'DA_GIAI_QUYET', 'DA_DONG']
TicketPriority = Literal['THAP', 'BINH_THUONG', 'CAO', 'KHAN_CAP']


class TicketCreate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    tieu_de: str = Field(min_length=1, max_length=200)
    noi_dung: str = Field(min_length=1, max_length=10000)
    ma_sp: str | None = Field(default=None, min_length=1, max_length=100)
    ma_donhang: str | None = Field(default=None, min_length=1, max_length=100)

    @field_validator('tieu_de', 'noi_dung', 'ma_sp', 'ma_donhang', mode='before')
    @classmethod
    def strip_text(cls, value):
        return value.strip() if isinstance(value, str) else value


class TicketUpdate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    trang_thai: TicketStatus = Field(default=None)
    muc_do_uu_tien: TicketPriority = Field(default=None)
    phan_hoi_quan_ly: str | None = Field(default=None, max_length=10000)
    nhan_xu_ly: bool = Field(default=False, strict=True)

    @field_validator('phan_hoi_quan_ly', mode='before')
    @classmethod
    def strip_reply(cls, value):
        return value.strip() or None if isinstance(value, str) else value

    @model_validator(mode='after')
    def require_changes(self):
        if not self.model_fields_set or self.model_fields_set == {'nhan_xu_ly'} and not self.nhan_xu_ly:
            raise ValueError('Chưa có thay đổi.')
        return self


class CustomerTicket(BaseModel):
    ma_phan_hoi: UUID
    tieu_de: str
    noi_dung: str
    ma_sp: str | None = None
    ma_donhang: str | None = None
    trang_thai: TicketStatus
    phan_hoi_quan_ly: str | None = None
    ngay_phan_hoi: datetime | None = None
    ngay_tao: datetime
    cap_nhat_luc: datetime


class AdminTicket(CustomerTicket):
    ma_kh: str
    ten_kh: str | None = None
    muc_do_uu_tien: TicketPriority
    nguoi_xu_ly: str | None = None
    ten_nguoi_xu_ly: str | None = None


class AdminTicketPage(BaseModel):
    data: list[AdminTicket]
    total: int
    page: int
    page_size: int


class CustomerTicketPage(BaseModel):
    data: list[CustomerTicket]
    total: int
    page: int
    page_size: int
