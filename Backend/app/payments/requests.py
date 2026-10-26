"""Payment execution boundary. Production performs no payment/database writes."""
from typing import Literal
from ..orders.schemas import InputModel
from .errors import PaymentError


class PaymentRequest(InputModel):
    method: Literal["cash", "bank_transfer", "card", "e_wallet"]


class UnconnectedPaymentRequests:
    def request(self, order_id, customer, method, key):
        raise PaymentError(503, "PAYMENT_INTEGRATION_REQUIRED", "Chức năng thực hiện thanh toán chưa được kết nối. Chưa ghi nhận thanh toán.")


def get_payment_requests():
    return UnconnectedPaymentRequests()
