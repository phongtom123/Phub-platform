from decimal import Decimal
from typing import Annotated, Literal
import re

from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_serializer, field_validator, model_validator

from ..catalog.schemas import clean_text


class InputModel(BaseModel):
    model_config = ConfigDict(extra="forbid")

    @field_validator("*", mode="before")
    @classmethod
    def trim_text(cls, value):
        return clean_text(value) if isinstance(value, str) else value


Money = Annotated[Decimal, Field(ge=0, max_digits=18, decimal_places=2)]


class Recipient(InputModel):
    name: str = Field(min_length=1, max_length=100)
    phone: str = Field(pattern=r"^\+?[0-9]{8,15}$")
    address_line: str = Field(min_length=1, max_length=255)
    province: str = Field(min_length=1, max_length=100)
    ward: str = Field(min_length=1, max_length=100)

    @field_validator("phone", mode="before")
    @classmethod
    def normalize_phone(cls, value):
        return re.sub(r"[ ()-]", "", clean_text(value)) if isinstance(value, str) else value


class OrderItem(InputModel):
    sku: str = Field(min_length=1, max_length=100)
    warehouse_id: StrictInt = Field(ge=-2_147_483_648, le=2_147_483_647)
    quantity: StrictInt = Field(ge=1, le=1000)
    expected_unit_price: Money = Field(
        description="Giá catalog khách vừa xem, dạng chuỗi thập phân. Chỉ dùng đối chiếu; giá bán lấy từ database.",
        json_schema_extra={"type": "string", "pattern": r"^[0-9]{1,16}(\.[0-9]{1,2})?$", "examples": ["15990000.00"]},
    )

    @field_validator("expected_unit_price", mode="before")
    @classmethod
    def require_decimal_string(cls, value):
        if not isinstance(value, str) or not re.fullmatch(r"[0-9]{1,16}(\.[0-9]{1,2})?", value):
            raise ValueError("Giá phải là chuỗi thập phân không âm, tối đa hai chữ số sau dấu chấm.")
        return value

    @field_serializer("expected_unit_price", when_used="json")
    def serialize_price(self, value):
        return format(value, ".2f")


class CreateOrder(InputModel):
    model_config = ConfigDict(extra="forbid", json_schema_extra={"examples": [{
        "recipient": {"name": "Nguyễn Văn A", "phone": "0901234567", "address_line": "123 Đường thử nghiệm", "province": "TP Hồ Chí Minh", "ward": "Phường thử nghiệm"},
        "items": [{"sku": "SKU-DEMO", "warehouse_id": -900001, "quantity": 1, "expected_unit_price": "15990000.00"}],
        "note": "Gọi trước khi giao",
    }]})
    recipient: Recipient
    items: list[OrderItem] = Field(min_length=1, max_length=100)
    note: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def unique_items(self):
        pairs = [(item.sku, item.warehouse_id) for item in self.items]
        if len(set(pairs)) != len(pairs):
            raise ValueError("Không được lặp cùng SKU và kho trong một đơn.")
        return self

    def canonical_payload(self):
        payload = self.model_dump(mode="json")
        payload["items"].sort(key=lambda item: (item["warehouse_id"], item["sku"]))
        payload["note"] = payload["note"] or None
        return payload


class MoneyModel(BaseModel):
    @field_serializer("*", when_used="json", check_fields=False)
    def serialize_decimal(self, value):
        return format(value, ".2f") if isinstance(value, Decimal) else value


class SoldItem(MoneyModel):
    sku: str
    warehouse_id: int
    name: str
    unit: str
    quantity: int = Field(ge=1)
    unit_price: Money
    tax_rate: Decimal = Field(ge=0, le=100)
    tax_amount: Money
    line_total: Money


class OrderReceipt(MoneyModel):
    id: str
    status: Literal["MOI"]
    sales_channel: Literal["ONLINE"]
    created_at: str
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    tax_application: Literal["invoice"]
    recipient: Recipient
    note: str | None
    items: list[SoldItem] = Field(min_length=1)
    subtotal: Money
    tax_total: Money
    total: Money

    @model_validator(mode="after")
    def consistent_totals(self):
        if any(item.unit_price * item.quantity != item.line_total or item.tax_amount != 0 or item.tax_rate != 10 for item in self.items):
            raise ValueError("Invalid order line totals or deferred tax")
        if self.subtotal != sum((item.line_total for item in self.items), Decimal(0)) or self.tax_total != 0 or self.total != self.subtotal:
            raise ValueError("Invalid order totals")
        return self
