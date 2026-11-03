from typing import Any, Literal

from pydantic import BaseModel


class OrderFinancialSummary(BaseModel):
    invoice_id: str | None
    invoice_status: Literal["DA_LAP", "CHUA_LAP"]
    payment_status: Literal["CHUA_CO_HOA_DON", "CHUA_THU", "THU_MOT_PHAN", "DA_THU_DU", "THU_THUA"]
    total: str | None
    collected: str
    refunded: str
    paid: str
    remaining: str | None


class AdminOrderDetail(BaseModel):
    order_id: str
    order: dict[str, Any]
    customer: dict[str, Any] | None
    employee: dict[str, Any] | None
    lines: list[dict[str, Any]]
    invoice: dict[str, Any] | None
    payments: list[dict[str, Any]]
    voucher_uses: list[dict[str, Any]]
    financial: OrderFinancialSummary
