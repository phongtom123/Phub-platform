from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field


class ReceiptLineDraft(BaseModel):
    sku: str = Field(min_length=1, max_length=200)
    quantity: int = Field(gt=0)
    unit_price: Decimal = Field(ge=0, max_digits=18, decimal_places=2)


class ReceiptDraftRequest(BaseModel):
    supplier_id: int
    warehouse_id: int
    note: str | None = Field(default=None, max_length=20000)
    lines: list[ReceiptLineDraft] = Field(min_length=1, max_length=500)


class TransferLineDraft(BaseModel):
    sku: str = Field(min_length=1, max_length=200)
    quantity: int = Field(gt=0)


class TransferDraftRequest(BaseModel):
    source_warehouse_id: int
    destination_warehouse_id: int
    note: str | None = Field(default=None, max_length=20000)
    lines: list[TransferLineDraft] = Field(min_length=1, max_length=500)


class DraftWorkflowResult(BaseModel):
    data: dict[str, Any]


class WarehouseOption(BaseModel):
    ma_kho: int
    ten_kho: str


class SupplierOption(BaseModel):
    ma_ncc: int
    ten_ncc: str


class ProductOption(BaseModel):
    sku: str
    ten_sp: str


class WarehouseOptionsResult(BaseModel):
    warehouses: list[WarehouseOption]
    suppliers: list[SupplierOption]
    products: list[ProductOption]
