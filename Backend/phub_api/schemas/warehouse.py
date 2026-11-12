"""Contracts for receiving and stock history in an employee's assigned warehouse."""
import re
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator, model_validator
from phub_api.schemas.pricing import PricingModel


class ReceiptLine(PricingModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    sku: str = Field(min_length=1, max_length=100)
    quantity: int = Field(strict=True, ge=1, le=1000000)
    unit_price: Decimal = Field(ge=0, max_digits=18, decimal_places=2)

    @field_serializer('unit_price')
    def decimal_price(self, value):
        return format(value, 'f')


class ReceiptCreate(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    supplier_id: int = Field(strict=True, ge=-(2**31), le=2**31-1)
    note: str | None = Field(None, max_length=2000)
    lines: list[ReceiptLine] = Field(min_length=1, max_length=100)

    @model_validator(mode='after')
    def unique_skus(self):
        if len({line.sku for line in self.lines}) != len(self.lines):
            raise ValueError('Mỗi SKU chỉ được xuất hiện một lần trong phiếu.')
        return self


class ReceiptVersion(BaseModel):
    model_config = ConfigDict(extra='forbid')
    expected_version: str = Field(pattern=r'^[a-f0-9]{64}$')

class ReceiptConfirmVersion(ReceiptVersion):
    pricing_version: str = Field(pattern=r'^[a-f0-9]{64}$')


class ReceiptUpdate(ReceiptCreate, ReceiptVersion):
    pass


class ReceiptHeader(BaseModel):
    ma_phieu_nhap: int
    ma_phieu_code: str
    ma_ncc: int
    ma_kho: int
    ngay_tao: datetime
    ngay_nhap: datetime | None = None
    trang_thai: Literal['NHAP', 'DA_NHAP', 'HUY']
    dinh_gia_da_ap_dung: bool = False
    nguoi_tao: str
    nguoi_cap_nhat: str | None = None
    nguoi_xac_nhan: str | None = None
    ghi_chu: str | None = None
    supplier_name: str


class ReceiptListItem(ReceiptHeader):
    creator_name: str | None = None
    line_count: int


class ReceiptLineRead(BaseModel):
    sku: str
    product_name: str
    quantity: int
    unit_price: Decimal
    unit: str
    pricing: dict | None = None


class WarehouseReceiptRead(BaseModel):
    receipt: ReceiptHeader
    lines: list[ReceiptLineRead]
    version: str
    replayed: bool = False


class WarehouseReceiptPage(BaseModel):
    data: list[ReceiptListItem]
    total: int
    page: int
    page_size: int
    warehouse_id: int | None = Field(description='Kho cụ thể; null khi danh sách bao gồm tất cả kho.')


class StockEvent(BaseModel):
    id: int
    warehouse_id: int
    sku: str
    product_name: str | None = None
    before_quantity: int
    after_quantity: int
    actor: str | None = None
    actor_name: str | None = None
    reason: str
    reference: str | None = None
    created_at: datetime


class WarehouseHistoryPage(BaseModel):
    data: list[StockEvent]
    total: int
    page: int
    page_size: int
    warehouse_id: int | None = Field(description='Kho cụ thể; null khi lịch sử bao gồm tất cả kho.')


class ManualInvoiceLine(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    sku: str = Field(min_length=1, max_length=100)
    quantity: int = Field(strict=True, ge=1, le=1000000)
    unit_price: Decimal = Field(ge=0, max_digits=18, decimal_places=2)
    discount: Decimal = Field(default=Decimal('0'), ge=0, max_digits=18, decimal_places=2)

    @field_serializer('unit_price', 'discount')
    def decimal_amount(self, value):
        return format(value, 'f')


class ManualInvoiceCreate(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    buyer: str = Field(min_length=1, max_length=200)
    email: str = Field(min_length=3, max_length=254)
    tax_id: str | None = Field(default=None, max_length=100)
    address: str | None = Field(default=None, max_length=500)
    lines: list[ManualInvoiceLine] = Field(min_length=1, max_length=100)

    @field_validator('email')
    @classmethod
    def normalize_email(cls, value):
        normalized = value.strip().lower()
        if not re.fullmatch(r'[^@\s]+@[^@\s]+\.[^@\s]+', normalized):
            raise ValueError('Nhập email khách hàng hợp lệ.')
        return normalized
