import os
import re

from fastapi import Depends

from phub_api.config.database import get_supabase
from phub_api.models.errors import PaymentError
from phub_api.repositories.payments import PaymentRepository
from phub_api.services.payment_requests import UnconnectedPaymentRequests
from phub_api.services.payments import PaymentService


def get_repository(db=Depends(get_supabase)):
    currency = os.getenv("CATALOG_CURRENCY", "VND")
    if not re.fullmatch(r"[A-Z]{3}", currency):
        raise PaymentError(503, "PAYMENT_CONFIGURATION_REQUIRED", "Cấu hình tiền tệ thanh toán chưa hợp lệ.")
    return PaymentRepository(db, currency)


def get_payment_requests():
    return UnconnectedPaymentRequests()


def get_service(repository: PaymentRepository = Depends(get_repository),
                payment_requests: object = Depends(get_payment_requests)) -> PaymentService:
    return PaymentService(repository, payment_requests)
