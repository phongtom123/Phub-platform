"""Typed commands for administrative use cases; generic table writes stay closed."""
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator
from phub_api.schemas.pricing import PricingOverrides

Resource = Literal['orders', 'receipts', 'inventory', 'settings', 'notifications', 'support']
Money = Decimal


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


class Line(StrictModel):
    sku: str = Field(min_length=1, max_length=100)
    quantity: int = Field(strict=True, ge=1, le=1000000)
    warehouse_id: int | None = Field(None, strict=True, ge=-(2**31), le=2**31-1)
    unit_price: Money | None = Field(None, ge=0, max_digits=18, decimal_places=2)


class ReceiptPricingLine(Line, PricingOverrides):
    pass

class Document(StrictModel):
    warehouse_id: int = Field(strict=True, ge=-(2**31), le=2**31-1)
    supplier_id: int | None = Field(None, strict=True, ge=-(2**31), le=2**31-1)
    note: str | None = Field(None, max_length=2000)
    lines: list[ReceiptPricingLine] = Field(min_length=1, max_length=100)

    @model_validator(mode='after')
    def unique_lines(self):
        if len({line.sku for line in self.lines}) != len(self.lines):
            raise ValueError('Không được trùng SKU trong phiếu.')
        return self


class PosOrder(StrictModel):
    customer_id: str | None = Field(None, min_length=1, max_length=100)
    recipient: str = Field(min_length=1, max_length=200)
    phone: str | None = Field(None, max_length=30)
    note: str | None = Field(None, max_length=2000)
    voucher_code: str | None = Field(None, max_length=100)
    lines: list[Line] = Field(min_length=1, max_length=100)

    @model_validator(mode='after')
    def valid_lines(self):
        if any(line.warehouse_id is None or line.unit_price is None for line in self.lines):
            raise ValueError('Mỗi sản phẩm cần kho xuất và giá đang hiển thị.')
        if len({(line.sku, line.warehouse_id) for line in self.lines}) != len(self.lines):
            raise ValueError('Không được trùng SKU và kho xuất.')
        if self.voucher_code and not self.customer_id:
            raise ValueError('Chọn khách hàng để kiểm tra giới hạn voucher.')
        return self


class Lines(StrictModel):
    lines: list[ReceiptPricingLine] = Field(min_length=1, max_length=100)

    @model_validator(mode='after')
    def unique_lines(self):
        if len({line.sku for line in self.lines}) != len(self.lines):
            raise ValueError('Không được trùng SKU trong phiếu.')
        return self


class Assignment(StrictModel):
    employee_id: str = Field(min_length=1, max_length=100)


class Payment(StrictModel):
    amount: Money = Field(gt=0, max_digits=18, decimal_places=2)
    method: Literal['TIEN_MAT', 'CHUYEN_KHOAN', 'THE', 'VI_DIEN_TU']
    reference: str | None = Field(None, min_length=1, max_length=200)

    @model_validator(mode='after')
    def reference_required(self):
        if self.method != 'TIEN_MAT' and not self.reference:
            raise ValueError('Giao dịch không dùng tiền mặt phải có mã đối soát.')
        return self


class Adjustment(StrictModel):
    warehouse_id: int = Field(strict=True, ge=-(2**31), le=2**31-1)
    sku: str = Field(min_length=1, max_length=100)
    expected_quantity: int = Field(strict=True, ge=0, le=2**31-1)
    quantity: int = Field(strict=True, ge=0, le=2**31-1)
    reason: str = Field(min_length=5, max_length=2000)


class Preferences(StrictModel):
    store_name: str = Field(min_length=1, max_length=200)
    store_address: str = Field(default='', max_length=500)
    store_phone: str = Field(default='', max_length=30)
    low_stock_threshold: int = Field(default=5, strict=True, ge=0, le=1000000)


class NotificationRead(StrictModel):
    ids: list[str] = Field(min_length=1, max_length=100)


class Message(StrictModel):
    text: str = Field(min_length=1, max_length=10000)


class Empty(StrictModel):
    pass

class ConfirmReceipt(StrictModel):
    pricing_version: str = Field(pattern=r'^[a-f0-9]{64}$')


COMMANDS = {
    ('orders', 'create'): PosOrder,
    ('orders', 'assign'): Assignment,
    **{('orders', action): Empty for action in ['confirm', 'prepare', 'dispatch', 'complete', 'cancel', 'invoice']},
    ('orders', 'payment'): Payment, ('orders', 'refund'): Payment,
    ('receipts', 'create'): Document,
    ('receipts', 'lines'): Lines,
    ('receipts', 'confirm'): ConfirmReceipt, ('receipts', 'cancel'): Empty,
    ('inventory', 'adjust'): Adjustment,
    ('settings', 'save'): Preferences, ('notifications', 'read'): NotificationRead,
    ('support', 'message'): Message,
}


class Command(StrictModel):
    action: str = Field(min_length=1, max_length=30)
    record_id: str | None = Field(None, min_length=1, max_length=200)
    expected_status: str | None = Field(None, max_length=30)
    data: dict = Field(default_factory=dict)


class CommandResult(BaseModel):
    data: list[dict]
    replayed: bool = False
