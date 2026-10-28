"""Header edits only; status transitions and stock movements are separate use cases."""
from pydantic import BaseModel, ConfigDict, Field


class ReceiptDraftUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ma_phieu_code: str | None = Field(None, min_length=1, max_length=2000)
    ma_ncc: int | None = Field(None, strict=True, ge=-(2**31), le=2**31 - 1)
    ma_kho: int | None = Field(None, strict=True, ge=-(2**31), le=2**31 - 1)
    ghi_chu: str | None = Field(None, max_length=20000)


class TransferDraftUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ma_kho_xuat: int | None = Field(None, strict=True, ge=-(2**31), le=2**31 - 1)
    ma_kho_nhan: int | None = Field(None, strict=True, ge=-(2**31), le=2**31 - 1)
    ghi_chu: str | None = Field(None, max_length=20000)


DRAFT_FIELDS = {
    "receipts": list(ReceiptDraftUpdate.model_fields),
    "transfers": list(TransferDraftUpdate.model_fields),
}
