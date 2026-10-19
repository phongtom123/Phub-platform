import os
import re

from phub_api.middleware.payment_errors import PaymentError
from phub_api.repositories.payments import PaymentRepository
from phub_api.services.payment_requests import UnconnectedPaymentRequests


def get_repository():
    from phub_api.config.database import supabase
    currency = os.getenv("CATALOG_CURRENCY", "VND")
    if not re.fullmatch(r"[A-Z]{3}", currency):
        raise PaymentError(503, "PAYMENT_CONFIGURATION_REQUIRED", "Cấu hình tiền tệ thanh toán chưa hợp lệ.")
    return PaymentRepository(supabase, currency)


def get_payment_requests():
    return UnconnectedPaymentRequests()
