from postgrest.exceptions import APIError


class ReceiptWorkflowError(Exception):
    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


class WarehouseRepository:
    def __init__(self, client):
        self.client = client

    def confirm_receipt(self, receipt_id: int, employee_id: str, warehouse_id: int | None):
        try:
            result = self.client.rpc("confirm_receipt", {
                "p_ma_phieu_nhap": receipt_id,
                "p_nguoi_xac_nhan": employee_id,
                "p_ma_kho_duoc_phep": warehouse_id,
            }).execute().data
        except APIError as exc:
            code = str(exc.code or "")
            mapping = {
                "P0002": (404, "Phiếu nhập không tồn tại."),
                "P0003": (409, "Phiếu nhập không ở trạng thái có thể xác nhận."),
                "P0004": (403, "Phiếu nhập không thuộc kho được phân quyền."),
                "P0005": (403, "Nhân viên xác nhận không còn hoạt động."),
                "P0006": (409, "Phiếu nhập chưa có sản phẩm."),
                "P0007": (422, "Số lượng nhập phải lớn hơn 0."),
            }
            status, detail = mapping.get(code, (503, "Dịch vụ dữ liệu kho chưa sẵn sàng."))
            raise ReceiptWorkflowError(status, detail) from None
        if not isinstance(result, dict):
            raise ReceiptWorkflowError(503, "Phản hồi transaction không hợp lệ.")
        return result
