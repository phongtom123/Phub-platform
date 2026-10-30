from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field, field_validator

class PricingModel(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)

    @field_validator('*', mode='before')
    @classmethod
    def no_binary_money(cls, value):
        if isinstance(value, (float, bool)):
            raise ValueError('Gửi tiền/tỷ lệ bằng chuỗi decimal, không dùng số thực binary.')
        return value

class TaxRule(PricingModel):
    code: str = Field(pattern=r'^[A-Z][A-Z0-9_]{0,29}$')
    rate: Decimal = Field(ge=0, le=100, max_digits=7, decimal_places=4)

class PricingOverrides(PricingModel):
    markup_rate: Decimal | None = Field(None, ge=0, max_digits=12, decimal_places=4)
    taxes: list[TaxRule] | None = Field(None, max_length=20)

class PricePreview(PricingOverrides):
    receipt_id: int | None = Field(None, ge=-(2**31), le=2**31-1)
    sku: str = Field(min_length=1, max_length=100)
    unit_cost: Decimal = Field(ge=0, max_digits=18, decimal_places=2)

class PricingConfig(PricingModel):
    markup_rate: Decimal | None = Field(ge=0, max_digits=12, decimal_places=4)
    taxes: list[TaxRule] | None = Field(max_length=20)
    expected_version: str = Field(pattern=r'^[a-f0-9]{64}$')

class TaxDefinition(PricingModel):
    code: str = Field(pattern=r'^[A-Z][A-Z0-9_]{0,29}$')
    name: str = Field(min_length=1, max_length=100)
    rate: Decimal = Field(ge=0, le=100, max_digits=7, decimal_places=4)

class TaxEdit(PricingModel):
    name: str = Field(min_length=1, max_length=100)
    rate: Decimal = Field(ge=0, le=100, max_digits=7, decimal_places=4)
