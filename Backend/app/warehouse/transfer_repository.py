from postgrest.exceptions import APIError


class TransferWorkflowError(Exception):
    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


class TransferRepository:
    def __init__(self, client):
        self.client = client

    def _call(self, function: str, transfer_id: int, employee_id: str, warehouse_id: int | None):
        try:
            data = self.client.rpc(function, {
                "p_ma_phieu_chuyen": transfer_id,
                "p_nguoi_xuat" if function == "dispatch_transfer" else "p_nguoi_nhan": employee_id,
                "p_ma_kho_duoc_phep": warehouse_id,
            }).execute().data
        except APIError as exc:
            codes = {
                "P0012": (404, "Phiếu chuyển kho không tồn tại."),
                "P0013": (409, "Phiếu chuyển kho không ở trạng thái phù hợp."),
                "P0014": (403, "Kho xuất không thuộc phạm vi được phân quyền."),
                "P0015": (403, "Kho nhận không thuộc phạm vi được phân quyền."),
                "P0016": (409, "Phiếu chuyển chưa có sản phẩm."),
                "P0017": (422, "Số lượng chuyển phải lớn hơn 0."),
                "P0018": (409, "Kho xuất không đủ tồn."),
            }
            status, detail = codes.get(str(exc.code or ""), (503, "Dịch vụ dữ liệu kho chưa sẵn sàng."))
            raise TransferWorkflowError(status, detail) from None
        if not isinstance(data, dict):
            raise TransferWorkflowError(503, "Phản hồi transaction không hợp lệ.")
        return data

    def dispatch(self, transfer_id: int, employee_id: str, warehouse_id: int | None):
        return self._call("dispatch_transfer", transfer_id, employee_id, warehouse_id)

    def receive(self, transfer_id: int, employee_id: str, warehouse_id: int | None):
        return self._call("receive_transfer", transfer_id, employee_id, warehouse_id)
