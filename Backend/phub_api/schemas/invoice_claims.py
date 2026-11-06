from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ClaimCreate(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    invoice_id: str = Field(min_length=1, max_length=100)
    evidence: str = Field(min_length=10, max_length=2000)


class ClaimDecision(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    action: Literal['approve', 'reject']
    expected_version: UUID
    verification_note: str = Field(min_length=10, max_length=2000)
    verified: bool = Field(default=False, strict=True)
    invoice_version: str | None = Field(default=None, pattern=r'^[a-f0-9]{64}$')

    @model_validator(mode='after')
    def proof_required(self):
        if self.action == 'approve' and (not self.verified or not self.invoice_version):
            raise ValueError('Phải đối chiếu hóa đơn và xác minh khách trước khi liên kết.')
        return self
