from pydantic import BaseModel, ConfigDict, Field, field_validator

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


def require_customer() -> CurrentCustomer:
    """Integration boundary: replace with the team's verified customer dependency.

    It must validate the session/token, account status and KHACH_HANG relation.
    No fallback to ma_kh, cookies, phone numbers or unverified bearer tokens.
    """
    raise PaymentError(
        503, "AUTH_INTEGRATION_REQUIRED",
        "Chưa kết nối phần xác thực khách hàng. Không thể sử dụng chức năng mua hàng lúc này.",
    )
