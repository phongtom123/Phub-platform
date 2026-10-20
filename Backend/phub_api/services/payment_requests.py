from phub_api.middleware.payment_errors import PaymentError


class UnconnectedPaymentRequests:
    def request(self, order_id, customer, method, key):
        raise PaymentError(503, "PAYMENT_INTEGRATION_REQUIRED", "Chức năng thực hiện thanh toán chưa được kết nối. Chưa ghi nhận thanh toán.")
