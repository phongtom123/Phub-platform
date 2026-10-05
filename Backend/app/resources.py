"""Explicit API allowlist. Column metadata is derived from the versioned DBML."""
import re
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from enum import Enum
from functools import lru_cache
from pathlib import Path
from typing import Any

from pydantic import ConfigDict, Field, create_model


@dataclass(frozen=True)
class Resource:
    table: str
    title: str
    keys: tuple[str, ...]
    writable: bool = False
    warehouse: bool = False


RESOURCES = {
    "warehouses": Resource("KHO", "Kho", ("ma_kho",), True, True),
    "employees": Resource("NHAN_VIEN", "Nhân viên", ("ma_nhan_vien",), True),
    "accounts": Resource("TAI_KHOAN", "Tài khoản", ("ma_tk",), True),
    "customers": Resource("KHACH_HANG", "Khách hàng", ("ma_kh",), True),
    "categories": Resource("LOAI_SP", "Loại sản phẩm", ("ma_loai_sp",), True, True),
    "products": Resource("SAN_PHAM", "Sản phẩm", ("ma_sp",), True, True),
    "inventory": Resource("TON_KHO", "Tồn kho", ("ma_kho", "sku"), warehouse=True),
    "suppliers": Resource("NHA_CUNG_CAP", "Nhà cung cấp", ("ma_ncc",), True, True),
    "receipts": Resource("PHIEU_NHAP", "Phiếu nhập", ("ma_phieu_nhap",), warehouse=True),
    "receipt-lines": Resource("CT_PHIEU_NHAP", "Chi tiết phiếu nhập", ("ma_phieu_nhap", "sku"), warehouse=True),
    "transfers": Resource("PHIEU_CHUYEN_KHO", "Chuyển kho", ("ma_phieu_chuyen",), warehouse=True),
    "transfer-lines": Resource("CT_CHUYEN_KHO", "Chi tiết chuyển kho", ("ma_phieu_chuyen", "sku"), warehouse=True),
    "orders": Resource("DON_HANG", "Đơn hàng", ("ma_donhang",)),
    "order-lines": Resource("CT_DON_HANG", "Chi tiết đơn hàng", ("ma_ct_donhang",)),
    "invoices": Resource("HOA_DON", "Hóa đơn", ("ma_hoadon",)),
    "payments": Resource("THANH_TOAN", "Thanh toán", ("ma_thanh_toan",)),
    "promotions": Resource("CHUONG_TRINH_KHUYEN_MAI", "Khuyến mãi", ("ma_ctkm",), True),
    "vouchers": Resource("VOUCHER", "Voucher", ("ma_voucher",), True),
    "voucher-uses": Resource("SU_DUNG_VOUCHER", "Sử dụng voucher", ("ma_su_dung",)),
}
ResourceName = Enum("ResourceName", {name.replace("-", "_"): name for name in RESOURCES}, type=str)


@lru_cache
def schema() -> dict[str, list[dict[str, Any]]]:
    source = (Path(__file__).resolve().parents[2] / "database" / "schema.dbml").read_text(encoding="utf-8")
    result = {}
    for table, block in re.findall(r"Table (\w+) \{(.*?)^\}", source, re.M | re.S):
        columns = []
        for name, kind, options in re.findall(r"^  (\w+) (int|varchar|text|datetime|decimal\(\d+,\d+\))([^\n]*)", block, re.M):
            default_match = re.search(r"default: ('[^']*'|-?\d+)", options)
            default = default_match.group(1).strip("'") if default_match else None
            if kind == "int" and default is not None:
                default = int(default)
            columns.append({"name": name, "type": kind, "required": "not null" in options or "pk" in options,
                            "generated": "increment" in options, "default": default})
        result[table] = columns
    return result


ENUMS = {
    ("employees", "loai_nhan_vien"): ["ADMIN", "THU_KHO"],
    ("promotions", "trang_thai"): ["NHAP", "HOAT_DONG", "TAM_DUNG", "KET_THUC"],
    ("vouchers", "trang_thai"): ["HOAT_DONG", "TAM_DUNG"],
    ("vouchers", "loai_giam"): ["PHAN_TRAM", "SO_TIEN"],
}
SYSTEM_FIELDS = {"promotions": {"nguoi_tao", "ngay_tao"}, "vouchers": {"ngay_tao"}}


def public_columns(name: str) -> list[dict[str, Any]]:
    return [column for column in schema()[RESOURCES[name].table] if column["name"] != "mat_khau_hash"]


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
        annotation = int if kind == "int" else datetime if kind == "datetime" else Decimal if kind.startswith("decimal") else str
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
