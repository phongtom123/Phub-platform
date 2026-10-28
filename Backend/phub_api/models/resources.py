from dataclasses import dataclass
from enum import Enum
from functools import lru_cache
from pathlib import Path
from typing import Any
import re

CUSTOMER_READ = {"customers", "orders", "order-lines", "invoices", "payments", "voucher-uses"}


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
    "accounts": Resource("TAI_KHOAN", "Tài khoản", ("ma_tk",)),
    "customers": Resource("KHACH_HANG", "Khách hàng", ("ma_kh",), True),
    "categories": Resource("LOAI_SP", "Loại sản phẩm", ("ma_loai_sp",), True, True),
    "subcategories": Resource("LOAI_SP_CON", "Loại sản phẩm con", ("ma_loai_sp_con",), True, True),
    "products": Resource("SAN_PHAM", "Sản phẩm", ("ma_sp",), True, True),
    "inventory": Resource("TON_KHO", "Tồn kho", ("ma_kho", "sku"), warehouse=True),
    "suppliers": Resource("NHA_CUNG_CAP", "Nhà cung cấp", ("ma_ncc",), True, True),
    "receipts": Resource("PHIEU_NHAP", "Phiếu nhập", ("ma_phieu_nhap",), warehouse=True),
    "receipt-lines": Resource("CT_PHIEU_NHAP", "Chi tiết phiếu nhập", ("ma_phieu_nhap", "sku"), warehouse=True),
    "transfers": Resource("PHIEU_CHUYEN_KHO", "Lịch sử chuyển kho", ("ma_phieu_chuyen",), warehouse=True),
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
    source = (Path(__file__).resolve().parents[2] / "schema.dbml").read_text(encoding="utf-8")
    result = {}
    for table, block in re.findall(r"Table (\w+) \{(.*?)^\}", source, re.M | re.S):
        columns = []
        for name, kind, options in re.findall(r"^  (\w+) (int|boolean|varchar|text|datetime|timestamptz|date|uuid|decimal\(\d+,\d+\))([^\n]*)", block, re.M):
            default_match = re.search(r"default: ('[^']*'|-?\d+|true|false)", options)
            default = default_match.group(1).strip("'") if default_match else None
            if kind == "int" and default is not None:
                default = int(default)
            if kind == "boolean" and default is not None:
                default = default == "true"
            columns.append({"name": name, "type": kind, "required": "not null" in options or "pk" in options,
                            "generated": "increment" in options, "default": default})
        result[table] = columns
    return result


ENUMS = {
    ("orders", "trang_thai"): ["MOI", "XAC_NHAN", "DANG_CHUAN_BI", "DA_XUAT_KHO", "HOAN_THANH", "HUY"],
    ("orders", "kenh_ban"): ["ONLINE", "TAI_QUAY"],
    ("receipts", "trang_thai"): ["NHAP", "DA_NHAP", "HUY"],
    ("transfers", "trang_thai"): ["NHAP", "DANG_CHUYEN", "DA_NHAN", "HUY"],
    ("payments", "trang_thai"): ["CHO_XU_LY", "THANH_CONG", "THAT_BAI"],
    ("payments", "phuong_thuc"): ["TIEN_MAT", "CHUYEN_KHOAN", "THE", "VI_DIEN_TU"],
    ("voucher-uses", "trang_thai"): ["DA_AP_DUNG", "DA_HUY"],
    ("employees", "loai_nhan_vien"): ["ADMIN", "NHAN_VIEN"],
    ("promotions", "trang_thai"): ["NHAP", "HOAT_DONG", "TAM_DUNG", "KET_THUC"],
    ("vouchers", "trang_thai"): ["HOAT_DONG", "TAM_DUNG"],
    ("vouchers", "loai_giam"): ["PHAN_TRAM", "SO_TIEN"],
}
SYSTEM_FIELDS = {"promotions": {"nguoi_tao", "ngay_tao"}, "vouchers": {"ngay_tao"},
                 "customers": {"ngay_tao", "cap_nhat_luc", "luu_tru_luc"}}


def public_columns(name: str) -> list[dict[str, Any]]:
    return [column for column in schema()[RESOURCES[name].table] if column["name"] not in {"mat_khau", "mat_khau_hash", "phien_ban_mat_khau"}]



CUSTOMER_CHILDREN = {"order-lines", "invoices", "payments", "voucher-uses"}
