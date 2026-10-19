from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.catalog import clean_text


class CurrentCustomer(BaseModel):

    model_config = ConfigDict(extra="forbid", frozen=True)
    customer_id: str = Field(min_length=1, max_length=100)

    @field_validator("customer_id", mode="before")
    @classmethod
    def normalize_id(cls, value):
        return clean_text(value) if isinstance(value, str) else value
