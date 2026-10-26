from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
import os
import re

from .errors import OrderError


@dataclass(frozen=True)
class OrderSettings:
    stock_policy: str
    price_tax_mode: str
    tax_rate: Decimal
    currency: str
    active_status: int
    tax_application: str = "invoice"

    @classmethod
    def from_env(cls):
        try:
            policy = os.getenv("ORDER_STOCK_POLICY", "reserve_on_order")
            mode = os.getenv("ORDER_PRICE_TAX_MODE", "exclusive")
            rate = Decimal(os.getenv("ORDER_TAX_RATE", "10"))
            application = os.getenv("ORDER_TAX_APPLICATION", "invoice")
            currency = os.getenv("CATALOG_CURRENCY", "VND")
            active = int(os.getenv("CATALOG_ACTIVE_STATUS", "1"))
            if policy != "reserve_on_order" or mode != "exclusive" or application != "invoice" or rate != 10:
                raise ValueError("Unsupported order policy")
            if not rate.is_finite() or not 0 <= rate <= 100 or rate != rate.quantize(Decimal("0.01")):
                raise ValueError("Invalid tax rate")
            if not re.fullmatch(r"[A-Z]{3}", currency) or not -2_147_483_648 <= active <= 2_147_483_647:
                raise ValueError("Invalid catalog configuration")
            return cls(policy, mode, rate, currency, active, application)
        except (KeyError, ValueError, InvalidOperation):
            raise OrderError(503, "ORDER_CONFIGURATION_REQUIRED", "Chưa có cấu hình đặt hàng phù hợp với quy tắc thuế và tồn kho của nhóm.") from None
