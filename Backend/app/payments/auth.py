from fastapi import Depends
from pydantic import BaseModel, ConfigDict, Field, field_validator

from ..auth import User, current_user
from ..catalog.schemas import clean_text
from .errors import PaymentError


class CurrentCustomer(BaseModel):
    """Trusted result of the team's authentication, never a request body/header."""

    model_config = ConfigDict(extra="forbid", frozen=True)
    customer_id: str = Field(min_length=1, max_length=100)

    @field_validator("customer_id", mode="before")
    @classmethod
    def normalize_id(cls, value):
        return clean_text(value) if isinstance(value, str) else value


def require_customer(user: User = Depends(current_user)) -> CurrentCustomer:
    """Return the customer identity verified by the shared session cookie.

    ``current_user`` validates the JWT, account status, password version and
    the TAI_KHOAN -> KHACH_HANG relation.  Customer APIs must never trust a
    customer id supplied in a request body, query string or custom header.
    """
    if user.role != "KHACH_HANG" or not user.customer_id:
        raise PaymentError(403, "AUTH_CUSTOMER_UNAVAILABLE", "Tài khoản chưa liên kết khách hàng hợp lệ.")
    return CurrentCustomer(customer_id=user.customer_id)
