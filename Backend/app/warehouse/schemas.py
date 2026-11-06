from pydantic import BaseModel, Field


class ReceiptConfirmation(BaseModel):
    ma_phieu_nhap: int
    ma_phieu_code: str
    ma_kho: int
    trang_thai: str
    nguoi_xac_nhan: str


class ReceiptWorkflowResult(BaseModel):
    ma_phieu_nhap: int
    ma_phieu_code: str
    ma_kho: int
    trang_thai: str
    nguoi_thuc_hien: str


class TransferWorkflowResult(BaseModel):
    ma_phieu_chuyen: int
    trang_thai: str
    nguoi_xuat: str | None = None
    nguoi_nhan: str | None = None


class OrderDispatchResult(BaseModel):
    ma_donhang: str
    trang_thai: str
    nguoi_xuat: str

class DispatchLine(BaseModel):
    sku: str = Field(min_length=1, max_length=200)
    warehouse_id: int
    quantity: int = Field(gt=0)

class DispatchDraftRequest(BaseModel):
    order_id: str = Field(min_length=1, max_length=100)
    warehouse_id: int
    note: str | None = Field(default=None, max_length=5000)
    lines: list[DispatchLine] = Field(min_length=1, max_length=500)

class DispatchWorkflowResult(BaseModel):
    ma_phieu_xuat: int
    ma_phieu_code: str
    trang_thai: str
    nguoi_xac_nhan: str | None = None
