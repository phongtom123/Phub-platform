from fastapi import Depends
from pydantic import BaseModel, ConfigDict, Field, field_validator

from ..auth import User, require_customer_user
from ..catalog.schemas import clean_text


class CurrentCustomer(BaseModel):
    """Trusted result of the team's authentication, never a request body/header."""

    model_config = ConfigDict(extra="forbid", frozen=True)
    customer_id: str = Field(min_length=1, max_length=100)

    @field_validator("customer_id", mode="before")
    @classmethod
    def normalize_id(cls, value):
        return clean_text(value) if isinstance(value, str) else value


def require_customer(user: User = Depends(require_customer_user)) -> CurrentCustomer:
    """Adapt the shared, DB-verified session to customer commerce dependencies."""
    return CurrentCustomer(customer_id=user.customer_id)
