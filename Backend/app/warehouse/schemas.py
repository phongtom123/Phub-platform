from pydantic import BaseModel


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
