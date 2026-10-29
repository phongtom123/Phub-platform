from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class HandoffRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    target_origin: str = Field(min_length=1, max_length=300)


class HandoffCode(BaseModel):
    code: str
    expires_in: int = 60


class HandoffExchange(HandoffRequest):
    code: str = Field(pattern=r"^[A-Za-z0-9_-]{43}$")
    role: Literal["ADMIN", "NHAN_VIEN"]
