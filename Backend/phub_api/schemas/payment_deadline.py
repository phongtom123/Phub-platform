from typing import Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, model_validator


class PaymentDeadline(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expires_at: AwareDatetime
    expired_at: AwareDatetime | None
    server_now: AwareDatetime
    status: Literal["awaiting_payment", "payment_received", "processing_expiry", "expired", "closed"]

    @model_validator(mode="after")
    def consistent_expiry(self):
        if self.status == "expired" and self.expired_at is None:
            raise ValueError("Expired deadline requires cancellation timestamp")
        if self.expired_at is not None and self.expired_at < self.expires_at:
            raise ValueError("Cancellation cannot precede deadline")
        return self
