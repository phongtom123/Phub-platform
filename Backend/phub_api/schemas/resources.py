"""Dynamic request schemas for the generic table APIs."""
from datetime import date, datetime
from decimal import Decimal
from functools import lru_cache
from uuid import UUID

from pydantic import ConfigDict, Field, create_model

from phub_api.models.resources import RESOURCES, SYSTEM_FIELDS, public_columns


@lru_cache
def payload_model(name: str, patch: bool):
    resource = RESOURCES[name]
    fields = {}
    for column in public_columns(name):
        key, kind = column["name"], column["type"]
        if key in SYSTEM_FIELDS.get(name, set()):
            continue
        if column["generated"] or (patch and key in resource.keys) or (patch and name == "products" and key == "sku"):
            continue
        annotation = int if kind == "int" else UUID if key == "ma_media_banner" else datetime if kind in {"datetime", "timestamptz"} else date if kind == "date" else Decimal if kind.startswith("decimal") else str
        constraints = {}
        if annotation is str:
            constraints = {"min_length": 1, "max_length": 20000 if kind == "text" else 2000}
        if annotation is Decimal:
            constraints = {"ge": 0, "max_digits": 18, "decimal_places": 2}
        if key == "bao_hanh_thang":
            constraints = {"ge": 0}
        if annotation is int and key.startswith("gioi_han"):
            constraints = {"gt": 0}
        if not column["required"]:
            annotation = annotation | None
        default = None if patch or not column["required"] else column["default"] if column["default"] is not None else ...
        fields[key] = (annotation, Field(default=default, **constraints))
    if name == "accounts":
        fields["password"] = (str, Field(default=None if patch else ..., min_length=10, max_length=128,
                                        description="Mật khẩu mới; server hash trước khi lưu. Khi PATCH, bỏ trường nếu không đổi mật khẩu.",
                                        json_schema_extra={"writeOnly": True, "format": "password"}))
    return create_model(f"{resource.table}{'Update' if patch else 'Create'}", __config__=ConfigDict(extra="forbid"), **fields)
