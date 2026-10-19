import os
import re

from app.middleware.payment_errors import PaymentError
from app.repositories.payments import PaymentRepository
from app.services.payment_requests import UnconnectedPaymentRequests


def get_repository():
    from app.config.database import supabase
    currency = os.getenv("CATALOG_CURRENCY", "VND")
    if not re.fullmatch(r"[A-Z]{3}", currency):
        raise PaymentError(503, "PAYMENT_CONFIGURATION_REQUIRED", "Cấu hình tiền tệ thanh toán chưa hợp lệ.")
    return PaymentRepository(supabase, currency)


def get_payment_requests():
    return UnconnectedPaymentRequests()
