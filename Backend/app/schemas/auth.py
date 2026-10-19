import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.config.settings import TOKEN_TTL_SECONDS


class LoginBody(BaseModel):
    username: str = Field(min_length=1, max_length=254, description="Tên tài khoản hoặc email đã tạo trong database.", examples=["example.admin"])
    password: str = Field(min_length=1, max_length=128, description="Mật khẩu của tài khoản thật; không phải khóa Supabase.",
                          json_schema_extra={"writeOnly": True, "format": "password"})


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int = TOKEN_TTL_SECONDS


class RegisterBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=2, max_length=200, examples=["Nguyen Van A"])
    username: str = Field(min_length=3, max_length=80, pattern=r"^[A-Za-z0-9_.-]+$", examples=["nguyenvana"])
    email: str = Field(min_length=3, max_length=254, examples=["customer@example.com"])
    phone: str | None = Field(default=None, max_length=20, examples=["0901234567"])
    password: str = Field(min_length=10, max_length=128, json_schema_extra={"writeOnly": True, "format": "password"})

    @field_validator("name", "username", mode="before")
    @classmethod
    def trim_text(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value):
        if not isinstance(value, str):
            return value
        value = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Email không đúng định dạng.")
        return value

    @field_validator("phone", mode="before")
    @classmethod
    def normalize_phone(cls, value):
        if value is None:
            return None
        if not isinstance(value, str):
            return value
        value = value.strip()
        if not value:
            return None
        if not re.fullmatch(r"\+?[0-9][0-9 .()-]{7,19}", value):
            raise ValueError("Số điện thoại không đúng định dạng.")
        return value
