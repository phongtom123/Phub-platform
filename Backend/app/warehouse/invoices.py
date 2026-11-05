from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..auth import User, current_user
from ..supabase import get_supabase

router = APIRouter(prefix="/api/warehouse/invoices", tags=["Warehouse Invoices"])


class InvoiceCreate(BaseModel):
    order_id: str = Field(min_length=1, max_length=100)
    buyer: str | None = Field(default=None, max_length=200)
    tax_id: str | None = Field(default=None, max_length=100)
    address: str | None = Field(default=None, max_length=500)


def _employee(user: User):
    if user.role not in {"ADMIN", "NHAN_VIEN_KHO"} or not user.employee_id:
        raise HTTPException(403, "Tài khoản không có quyền lập hóa đơn.")


def _money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


@router.get("")
def list_invoices(user: User = Depends(current_user), db=Depends(get_supabase)):
    _employee(user)
    rows = db.table("HOA_DON").select("ma_hoadon,ma_donhang,thoi_gian_lap,ten_nguoi_mua,tong_tien_sau_thue,nguoi_lap").order("thoi_gian_lap", desc=True).limit(500).execute().data
    return [{"id": row["ma_hoadon"], "recordId": row["ma_donhang"], "order": row["ma_donhang"], "buyer": row.get("ten_nguoi_mua") or "—", "employeeCode": row.get("nguoi_lap") or "—", "total": f'{Decimal(str(row.get("tong_tien_sau_thue") or 0)):,.0f} ₫', "created": row.get("thoi_gian_lap") or "—", "status": "Hoàn tất"} for row in rows]

@router.get("/customer-search")
def customer_search(q: str = "", user: User = Depends(current_user), db=Depends(get_supabase)):
    _employee(user)
    term = q.strip()[:100].replace(",", " ").replace("%", "")
    if len(term) < 2: return {"customers": [], "orders": []}
    account_matches = db.table("TAI_KHOAN").select("ma_kh,email").ilike("email", f"%{term}%").limit(50).execute().data
    email_by_customer = {row["ma_kh"]: row.get("email") for row in account_matches if row.get("ma_kh")}
    account_customer_ids = list(email_by_customer)
    customers = db.table("KHACH_HANG").select("ma_kh,ten_kh,sdt,dia_chi_chi_tiet_md").or_(f"sdt.ilike.%{term}%,ma_kh.ilike.%{term}%,ten_kh.ilike.%{term}%").limit(50).execute().data
    if account_customer_ids:
        customers += db.table("KHACH_HANG").select("ma_kh,ten_kh,sdt,dia_chi_chi_tiet_md").in_("ma_kh", account_customer_ids).limit(50).execute().data
        customers = list({row["ma_kh"]: row for row in customers}.values())
    for customer in customers:
        customer["email"] = email_by_customer.get(customer["ma_kh"])
    ids = [row["ma_kh"] for row in customers]
    if not ids: return {"customers": [], "orders": []}
    orders = db.table("DON_HANG").select("ma_donhang,ma_kh,ten_nguoi_nhan,trang_thai").in_("ma_kh", ids).in_("trang_thai", ["DA_XUAT_KHO", "HOAN_THANH"]).limit(200).execute().data
    issued = {row["ma_donhang"] for row in db.table("HOA_DON").select("ma_donhang").in_("ma_donhang", [row["ma_donhang"] for row in orders]).limit(500).execute().data} if orders else set()
    return {"customers": customers, "orders": [row for row in orders if row["ma_donhang"] not in issued]}


@router.get("/options")
def invoice_options(user: User = Depends(current_user), db=Depends(get_supabase)):
    _employee(user)
    orders = db.table("DON_HANG").select("ma_donhang,ten_nguoi_nhan").in_("trang_thai", ["DA_XUAT_KHO", "HOAN_THANH"]).limit(500).execute().data
    invoices = db.table("HOA_DON").select("ma_donhang").limit(500).execute().data
    issued = {row["ma_donhang"] for row in invoices}
    result = []
    for order in orders:
        if order["ma_donhang"] in issued:
            continue
        lines = db.table("CT_DON_HANG").select("so_luong,don_gia,giam_gia,giam_gia_voucher").eq("ma_donhang", order["ma_donhang"]).limit(500).execute().data
        total = sum((Decimal(str(line["so_luong"])) * Decimal(str(line["don_gia"])) - Decimal(str(line.get("giam_gia") or 0)) - Decimal(str(line.get("giam_gia_voucher") or 0))) for line in lines)
        result.append({"order_id": order["ma_donhang"], "buyer": order.get("ten_nguoi_nhan") or "Khách lẻ", "total": float(_money(total))})
    return result

@router.get("/{invoice_id}")
def invoice_detail(invoice_id: str, user: User = Depends(current_user), db=Depends(get_supabase)):
    _employee(user)
    invoice_rows = db.table("HOA_DON").select("ma_hoadon,ma_donhang,thoi_gian_lap,ten_nguoi_mua,ma_so_thue,dia_chi_nguoi_mua,tong_tien_giam,tong_tien_truoc_thue,tong_tien_thue,tong_tien_sau_thue,nguoi_lap").eq("ma_hoadon", invoice_id).limit(1).execute().data
    if not invoice_rows:
        raise HTTPException(404, "Không tìm thấy hóa đơn.")
    row = invoice_rows[0]
    lines = db.table("CT_DON_HANG").select("sku,ten_sp_luc_ban,don_vi_luc_ban,so_luong,don_gia,giam_gia,giam_gia_voucher").eq("ma_donhang", row["ma_donhang"]).limit(1000).execute().data
    return {"invoice": row, "lines": lines}


@router.post("", status_code=201)
def create_invoice(body: InvoiceCreate, user: User = Depends(current_user), db=Depends(get_supabase)):
    _employee(user)
    existing = db.table("HOA_DON").select("ma_hoadon").eq("ma_donhang", body.order_id).limit(1).execute().data
    if existing:
        raise HTTPException(409, "Đơn hàng đã được lập hóa đơn.")
    order = db.table("DON_HANG").select("ma_donhang,trang_thai,ten_nguoi_nhan,dia_chi_chi_tiet").eq("ma_donhang", body.order_id).limit(1).execute().data
    if not order:
        raise HTTPException(404, "Không tìm thấy đơn hàng.")
    if order[0]["trang_thai"] not in {"DA_XUAT_KHO", "HOAN_THANH"}:
        raise HTTPException(409, "Chỉ lập hóa đơn cho đơn đã xuất kho hoặc hoàn thành.")
    lines = db.table("CT_DON_HANG").select("so_luong,don_gia,giam_gia,giam_gia_voucher").eq("ma_donhang", body.order_id).limit(500).execute().data
    if not lines:
        raise HTTPException(409, "Đơn hàng chưa có sản phẩm.")
    discount = sum((Decimal(str(line.get("giam_gia") or 0)) + Decimal(str(line.get("giam_gia_voucher") or 0)) for line in lines), Decimal(0))
    before_tax = sum((Decimal(str(line["so_luong"])) * Decimal(str(line["don_gia"])) - Decimal(str(line.get("giam_gia") or 0)) - Decimal(str(line.get("giam_gia_voucher") or 0)) for line in lines), Decimal(0))
    tax = _money(before_tax * Decimal("0.10"))
    total = _money(before_tax + tax)
    code = f"HD-{datetime.now(timezone.utc):%Y%m%d}-{uuid4().hex[:6].upper()}"
    row = {"ma_hoadon": code, "ma_donhang": body.order_id, "thoi_gian_lap": datetime.now(timezone.utc).isoformat(), "ten_nguoi_mua": body.buyer or order[0].get("ten_nguoi_nhan") or "Khách lẻ", "ma_so_thue": body.tax_id, "dia_chi_nguoi_mua": body.address or order[0].get("dia_chi_chi_tiet"), "tong_tien_giam": str(_money(discount)), "tong_tien_truoc_thue": str(_money(before_tax)), "tong_tien_thue": str(tax), "tong_tien_sau_thue": str(total), "nguoi_lap": user.employee_id}
    db.table("HOA_DON").insert(row).execute()
    return {"data": {"id": code, "recordId": body.order_id, "order": body.order_id, "buyer": row["ten_nguoi_mua"], "employeeCode": user.employee_id, "total": f"{total:,.0f} ₫", "created": row["thoi_gian_lap"], "status": "Hoàn tất"}}
