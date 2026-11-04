from typing import Literal

from pydantic import Field, field_validator

from phub_api.schemas.orders import InputModel, Recipient

FulfillmentMethod = Literal["GIAO_HANG", "TAI_CUA_HANG"]


class PickupContact(InputModel):
    name: str = Field(min_length=1, max_length=100)
    phone: str = Field(pattern=r"^\+?[0-9]{8,15}$")

    @field_validator("phone", mode="before")
    @classmethod
    def normalize_phone(cls, value):
        return Recipient.normalize_phone(value)


class PickupRecipient(PickupContact):
    address_line: None = None
    province: None = None
    ward: None = None
