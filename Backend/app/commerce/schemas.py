from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator, model_validator

from ..catalog.schemas import Pagination
from ..orders.schemas import InputModel, Money, OrderItem, Recipient
from ..payments.schemas import OrderId


class CartItem(InputModel):
    sku: str = Field(min_length=1, max_length=100)
    quantity: int = Field(strict=True, ge=1, le=1000)


class VoucherInput(InputModel):
    voucher_code: str | None = Field(default=None, max_length=100)

    @field_validator("voucher_code")
    @classmethod
    def normalize_code(cls, value):
        return value.strip().upper() or None if value is not None else None


class QuoteRequest(VoucherInput):
    items: list[CartItem] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def unique_skus(self):
        if len({item.sku for item in self.items}) != len(self.items):
            raise ValueError("Mỗi SKU chỉ được xuất hiện một lần trong giỏ hàng.")
        return self


class CustomerOrderRequest(VoucherInput):
    recipient: Recipient
    items: list[OrderItem] = Field(min_length=1, max_length=100)
    note: str | None = Field(default=None, max_length=2000)
    expected_discount: Money
    expected_total: Money

    @field_validator("expected_discount", "expected_total", mode="before")
    @classmethod
    def require_decimal_string(cls, value):
        return OrderItem.require_decimal_string(value)

    @field_serializer("expected_discount", "expected_total", when_used="json")
    def serialize_expected(self, value):
        return format(value, ".2f")

    @model_validator(mode="after")
    def unique_skus(self):
        if len({item.sku for item in self.items}) != len(self.items):
            raise ValueError("Mỗi SKU chỉ được xuất hiện một lần trong đơn checkout.")
        return self

    def canonical_payload(self):
        payload = self.model_dump(mode="json")
        payload["items"].sort(key=lambda item: item["sku"])
        payload["note"] = payload["note"] or None
        return payload


class MoneyOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    @field_serializer("*", when_used="json", check_fields=False)
    def decimal_strings(self, value):
        return format(value, ".2f") if isinstance(value, Decimal) else value


class CheckoutLine(MoneyOutput):
    sku: str
    warehouse_id: int
    name: str
    unit: str
    quantity: int = Field(ge=1, le=1000)
    unit_price: Money
    gross_total: Money
    discount: Money
    tax_rate: Decimal = Field(ge=0, le=100)
    tax_amount: Money
    line_total: Money


class CheckoutQuote(MoneyOutput):
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    tax_application: Literal["invoice"]
    shipping_status: Literal["not_quoted"]
    voucher_code: str | None
    items: list[CheckoutLine] = Field(min_length=1, max_length=100)
    subtotal: Money
    discount_total: Money
    tax_total: Money
    total: Money

    @model_validator(mode="after")
    def consistent_totals(self):
        if any(line.gross_total != line.unit_price * line.quantity or line.discount > line.gross_total
               or line.line_total != line.gross_total - line.discount or line.tax_amount != 0 or line.tax_rate != 10
               for line in self.items):
            raise ValueError("Invalid checkout line amounts")
        if (self.subtotal != sum((line.gross_total for line in self.items), Decimal(0))
                or self.discount_total != sum((line.discount for line in self.items), Decimal(0))
                or self.tax_total != 0 or self.total != self.subtotal - self.discount_total):
            raise ValueError("Invalid checkout totals")
        return self


class CustomerOrderReceipt(CheckoutQuote):
    id: OrderId
    status: Literal["MOI"]
    sales_channel: Literal["ONLINE"]
    created_at: str
    recipient: Recipient
    note: str | None


class CustomerProfile(BaseModel):
    model_config = ConfigDict(extra="forbid")
    customer_id: str
    name: str
    phone: str | None
    address_line: str | None
    province: str | None
    ward: str | None


class OrderQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")
    page: int = Field(default=1, ge=1, le=1_000_000)
    page_size: int = Field(default=20, ge=1, le=100)


class OrderSummary(MoneyOutput):
    id: OrderId
    status: Literal["MOI", "XAC_NHAN", "DANG_CHUAN_BI", "DA_XUAT_KHO", "HOAN_THANH", "HUY", "UNKNOWN"]
    created_at: str
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    total: Money


class OrderPage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[OrderSummary]
    pagination: Pagination


class StoredLine(MoneyOutput):
    sku: str
    warehouse_id: int
    name: str
    unit: str
    quantity: int = Field(ge=1)
    unit_price: Money
    discount: Money
    tax_amount: Money
    line_total: Money


class StoredRecipient(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None
    phone: str | None
    address_line: str | None
    province: str | None
    ward: str | None


class OrderDetail(OrderSummary):
    recipient: StoredRecipient
    note: str | None
    items: list[StoredLine]


class InvoiceTotals(MoneyOutput):
    issued_at: str
    discount_total: Money
    subtotal: Money
    tax_total: Money
    total: Money


class InvoiceOverview(BaseModel):
    model_config = ConfigDict(extra="forbid")
    order_id: OrderId
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    invoice: InvoiceTotals | None
    items: list[StoredLine]
