from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from phub_api.config.database import get_supabase
from phub_api.dependencies.auth import current_user
from phub_api.models.user import User

router = APIRouter(prefix="/api/warehouse/invoices", tags=["Kho · Hóa đơn"])


class InvoiceCreate(BaseModel):
    order_id: str = Field(min_length=1, max_length=100)
    buyer: str | None = Field(default=None, max_length=200)
    tax_id: str | None = Field(default=None, max_length=100)
    address: str | None = Field(default=None, max_length=500)


def _employee(user: User):
    if user.role not in {"ADMIN", "NHAN_VIEN"} or not user.employee_id:
        raise HTTPException(403, "Tài khoản không có quyền lập hóa đơn.")


def _money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


@router.get("")
def list_invoices(user: User = Depends(current_user), db=Depends(get_supabase)):
    _employee(user)
    rows = db.table("HOA_DON").select(
        "ma_hoadon,ma_donhang,thoi_gian_lap,ten_nguoi_mua,tong_tien_sau_thue,nguoi_lap"
    ).order("thoi_gian_lap", desc=True).limit(500).execute().data
    return [{
        "id": row["ma_hoadon"], "recordId": row["ma_donhang"], "order": row["ma_donhang"],
        "buyer": row.get("ten_nguoi_mua") or "—", "employeeCode": row.get("nguoi_lap") or "—",
        "total": f'{Decimal(str(row.get("tong_tien_sau_thue") or 0)):,.0f} ₫',
        "created": row.get("thoi_gian_lap") or "—", "status": "Hoàn tất",
    } for row in rows]


@router.get("/customer-search")
def customer_search(q: str = "", user: User = Depends(current_user), db=Depends(get_supabase)):
    _employee(user)
    term = q.strip()[:100].replace(",", " ").replace("%", "")
    if len(term) < 2:
        return {"customers": [], "orders": []}
    customers = db.table("KHACH_HANG").select(
        "ma_kh,ten_kh,sdt,dia_chi_chi_tiet_md"
    ).or_(f"sdt.ilike.%{term}%,ma_kh.ilike.%{term}%,ten_kh.ilike.%{term}%").limit(50).execute().data
    ids = [row["ma_kh"] for row in customers]
    if not ids:
        return {"customers": [], "orders": []}
    orders = db.table("DON_HANG").select(
        "ma_donhang,ma_kh,ten_nguoi_nhan,trang_thai"
    ).in_("ma_kh", ids).in_("trang_thai", ["DA_XUAT_KHO", "HOAN_THANH"]).limit(200).execute().data
    issued = {row["ma_donhang"] for row in db.table("HOA_DON").select(
        "ma_donhang"
    ).in_("ma_donhang", [row["ma_donhang"] for row in orders]).limit(500).execute().data} if orders else set()
    return {"customers": customers, "orders": [row for row in orders if row["ma_donhang"] not in issued]}


@router.get("/options")
def invoice_options(user: User = Depends(current_user), db=Depends(get_supabase)):
    _employee(user)
    orders = db.table("DON_HANG").select("ma_donhang,ten_nguoi_nhan").in_(
        "trang_thai", ["DA_XUAT_KHO", "HOAN_THANH"]
    ).limit(500).execute().data
    issued = {row["ma_donhang"] for row in db.table("HOA_DON").select("ma_donhang").limit(500).execute().data}
    return [{"order_id": order["ma_donhang"], "buyer": order.get("ten_nguoi_nhan") or "Khách lẻ", "total": 0} for order in orders if order["ma_donhang"] not in issued]


@router.get("/{invoice_id}")
def invoice_detail(invoice_id: str, user: User = Depends(current_user), db=Depends(get_supabase)):
    _employee(user)
    rows = db.table("HOA_DON").select(
        "ma_hoadon,ma_donhang,thoi_gian_lap,ten_nguoi_mua,ma_so_thue,dia_chi_nguoi_mua,tong_tien_giam,tong_tien_truoc_thue,tong_tien_thue,tong_tien_sau_thue,nguoi_lap"
    ).eq("ma_hoadon", invoice_id).limit(1).execute().data
    if not rows:
        raise HTTPException(404, "Không tìm thấy hóa đơn.")
    row = rows[0]
    lines = db.table("CT_DON_HANG").select(
        "sku,ten_sp_luc_ban,don_vi_luc_ban,so_luong,don_gia,giam_gia,giam_gia_voucher"
    ).eq("ma_donhang", row["ma_donhang"]).limit(1000).execute().data
    return {"invoice": row, "lines": lines}
