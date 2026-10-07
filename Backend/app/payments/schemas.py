from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, field_serializer

from ..catalog.schemas import Pagination, clean_text


OrderId = Annotated[str, BeforeValidator(clean_text), Field(min_length=1, max_length=100)]


class NoQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")


class TransactionQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")
    page: int = Field(default=1, ge=1, le=1_000_000)
    page_size: int = Field(default=20, ge=1, le=100)


class PaymentTransaction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["collection", "refund", "unknown"]
    method: Literal["cash", "bank_transfer", "card", "e_wallet", "unknown"]
    amount: Decimal = Field(ge=0, max_digits=18, decimal_places=2)
    status: Literal["pending", "succeeded", "failed", "unknown"]
    occurred_at: datetime | None
    message: str

    @field_serializer("amount", when_used="json")
    def serialize_amount(self, value):
        return format(value, ".2f")


class PaymentOverview(BaseModel):
    model_config = ConfigDict(extra="forbid")

    order_id: str
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    latest_transaction: PaymentTransaction | None = Field(description="Trạng thái giao dịch mới nhất, có thể là thu hoặc hoàn tiền. Không phải kết luận đã tất toán toàn đơn.")
    message: str


class TransactionPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    order_id: str
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    items: list[PaymentTransaction]
    pagination: Pagination
