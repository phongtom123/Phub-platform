import os

from phub_api.config.orders import OrderSettings
from phub_api.config.warehouse import OPERATING_WAREHOUSE_ID, WAREHOUSE_SCOPE_MESSAGE
from phub_api.models.errors import PaymentError


def checkout_parameters(payload, customer, *, create, key=None, settings=None):
    if create and any(item.get('warehouse_id') != OPERATING_WAREHOUSE_ID for item in payload['items']):
        raise PaymentError(422, 'SINGLE_WAREHOUSE', WAREHOUSE_SCOPE_MESSAGE)
    settings = settings or OrderSettings.from_env()
    return {
        "p_customer_id": customer.customer_id, "p_request": payload,
        "p_key": str(key) if key is not None else None, "p_create": create,
        "p_stock_policy": settings.stock_policy, "p_price_tax_mode": settings.price_tax_mode,
        "p_tax_rate": format(settings.tax_rate, ".2f"), "p_currency": settings.currency,
        "p_active_status": settings.active_status, "p_tax_application": settings.tax_application,
        "p_promotion_timezone": os.getenv("CHECKOUT_PROMOTION_TIMEZONE", "Asia/Ho_Chi_Minh"),
    }
