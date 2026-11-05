from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from postgrest.exceptions import APIError
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


class ManualInvoiceLine(BaseModel):
    sku: str = Field(min_length=1, max_length=100)
    quantity: int = Field(gt=0, le=1000000)
    unit_price: Decimal = Field(ge=0, max_digits=18, decimal_places=2)
    discount: Decimal = Field(default=Decimal("0"), ge=0, max_digits=18, decimal_places=2)


class ManualInvoiceCreate(BaseModel):
    buyer: str = Field(min_length=1, max_length=200)
    email: str = Field(min_length=3, max_length=200)
    tax_id: str | None = Field(default=None, max_length=100)
    address: str | None = Field(default=None, max_length=500)
    lines: list[ManualInvoiceLine] = Field(min_length=1, max_length=500)


def _employee(user: User):
    if user.role not in {"ADMIN", "NHAN_VIEN"} or not user.employee_id:
        raise HTTPException(403, "Tài khoản không có quyền lập hóa đơn.")


def _money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


@router.get("")
def list_invoices(user: User = Depends(current_user), db=Depends(get_supabase)):
    _employee(user)
    # The email column is introduced by the manual-invoice migration. Keep the
    # list endpoint usable while an older Supabase schema is still deployed.
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
    email = q.strip().lower()[:200]
    if len(email) < 2:
        return {"customers": [], "orders": []}
    # Email is normalized at the boundary and matched case-insensitively so
    # users are not blocked by the casing used when the account was created.
    accounts = db.table("TAI_KHOAN").select("ma_kh,email").ilike("email", f"%{email}%").limit(10).execute().data
    exact_customer_ids = [row["ma_kh"] for row in accounts if row.get("ma_kh") and (row.get("email") or "").lower() == email]
    customer_ids = list(dict.fromkeys(row["ma_kh"] for row in accounts if row.get("ma_kh")))
    if len(exact_customer_ids) > 1:
        raise HTTPException(409, "Email khách hàng đang bị trùng dữ liệu.")
    if not customer_ids:
        return {"customers": [], "orders": []}
    customers = db.table("KHACH_HANG").select(
        "ma_kh,ten_kh,sdt,dia_chi_chi_tiet_md"
    ).in_("ma_kh", customer_ids).limit(50).execute().data
    email_by_customer = {row.get("ma_kh"): row.get("email") for row in accounts}
    customers = [{**row, "email": email_by_customer.get(row.get("ma_kh"))} for row in customers]
    ids = [row["ma_kh"] for row in customers]
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


@router.get("/order-preview")
def invoice_order_preview(order_id: str, user: User = Depends(current_user), db=Depends(get_supabase)):
    _employee(user)
    orders = db.table("DON_HANG").select(
        "ma_donhang,ma_kh,trang_thai,ten_nguoi_nhan,dia_chi_chi_tiet"
    ).eq("ma_donhang", order_id.strip()).limit(1).execute().data
    if not orders:
        raise HTTPException(404, "Không tìm thấy đơn hàng.")
    order = orders[0]
    if order["trang_thai"] not in {"DA_XUAT_KHO", "HOAN_THANH"}:
        raise HTTPException(409, "Đơn hàng chưa đủ điều kiện lập hóa đơn.")
    lines = db.table("CT_DON_HANG").select(
        "sku,ten_sp_luc_ban,don_vi_luc_ban,so_luong,don_gia,giam_gia,giam_gia_voucher"
    ).eq("ma_donhang", order_id.strip()).limit(500).execute().data
    if not lines:
        raise HTTPException(409, "Đơn hàng chưa có sản phẩm.")
    discount = sum((Decimal(str(line.get("giam_gia") or 0)) + Decimal(str(line.get("giam_gia_voucher") or 0)) for line in lines), Decimal(0))
    subtotal = sum((Decimal(str(line["so_luong"])) * Decimal(str(line["don_gia"])) for line in lines), Decimal(0))
    before_tax = _money(subtotal - discount)
    tax = _money(before_tax * Decimal("0.10"))
    return {
        "order": order,
        "lines": lines,
        "summary": {"subtotal": str(_money(subtotal)), "discount": str(_money(discount)), "before_tax": str(before_tax), "tax": str(tax), "total": str(_money(before_tax + tax))},
    }


def _create_manual_invoice_legacy(body: ManualInvoiceCreate, user: User, db):
    """Fallback for Supabase projects where migration 011 is not deployed yet."""
    created = datetime.now(timezone.utc).isoformat()
    order_id = f"MAN-{uuid4().hex.upper()}"
    invoice_id = f"HD-{datetime.now(timezone.utc):%Y%m%d}-{uuid4().hex[:6].upper()}"
    products = db.table("SAN_PHAM").select("sku,ten_sp,don_vi").in_("sku", [line.sku.strip() for line in body.lines]).eq("trang_thai", 1).limit(500).execute().data
    product_map = {row["sku"]: row for row in products}
    if any(line.sku.strip() not in product_map for line in body.lines):
        raise HTTPException(404, "Không tìm thấy sản phẩm hoặc SKU không hợp lệ.")
    subtotal = Decimal("0"); discount_total = Decimal("0"); tax_total = Decimal("0"); lines = []
    for line in body.lines:
        quantity = Decimal(line.quantity); unit_price = line.unit_price; discount = line.discount
        base = quantity * unit_price - discount
        tax = _money(base * Decimal("0.10")); total = base + tax
        subtotal += base; discount_total += discount; tax_total += tax
        product = product_map[line.sku.strip()]
        lines.append({"ma_donhang": order_id, "sku": product["sku"], "ma_kho_xuat": user.warehouse_id, "ten_sp_luc_ban": product["ten_sp"], "don_vi_luc_ban": product.get("don_vi") or "Cái", "so_luong": line.quantity, "don_gia": str(unit_price), "giam_gia": str(discount), "giam_gia_voucher": "0", "thue_suat": "10", "tien_thue": str(tax), "thanh_tien": str(total)})
    db.table("DON_HANG").insert({"ma_donhang": order_id, "kenh_ban": "TAI_QUAY", "trang_thai": "DA_XUAT_KHO", "thoi_gian_dat": created, "thoi_gian_xuat_kho": created, "ten_nguoi_nhan": body.buyer.strip(), "dia_chi_chi_tiet": body.address.strip() if body.address else None, "ghi_chu": f"EMAIL_HOA_DON:{body.email.strip().lower()}", "ma_nhan_vien": user.employee_id}).execute()
    db.table("CT_DON_HANG").insert(lines).execute()
    invoice = {"ma_hoadon": invoice_id, "ma_donhang": order_id, "thoi_gian_lap": created, "ten_nguoi_mua": body.buyer.strip(), "ma_so_thue": body.tax_id.strip() if body.tax_id else None, "dia_chi_nguoi_mua": body.address.strip() if body.address else None, "tong_tien_giam": str(_money(discount_total)), "tong_tien_truoc_thue": str(_money(subtotal)), "tong_tien_thue": str(_money(tax_total)), "tong_tien_sau_thue": str(_money(subtotal + tax_total)), "nguoi_lap": user.employee_id}
    try:
        db.table("HOA_DON").insert({**invoice, "email_nguoi_mua": body.email.strip().lower()}).execute()
    except APIError:
        db.table("HOA_DON").insert(invoice).execute()
    return {"data": {"id": invoice_id, "recordId": order_id, "order": order_id, "buyer": body.buyer.strip(), "employeeCode": user.employee_id, "total": f"{_money(subtotal + tax_total):,.0f} ₫", "created": created, "status": "Hoàn tất"}}


@router.post("/manual", status_code=201)
def create_manual_invoice(body: ManualInvoiceCreate, user: User = Depends(current_user), db=Depends(get_supabase)):
    _employee(user)
    if user.warehouse_id is None:
        raise HTTPException(403, "Tài khoản chưa được phân công kho.")
    try:
        result = db.rpc("create_manual_invoice", {
            "p_actor": user.account_id, "p_warehouse": user.warehouse_id,
            "p_buyer": body.buyer.strip(), "p_email": body.email.strip().lower(),
            "p_tax_id": body.tax_id.strip() if body.tax_id else None,
            "p_address": body.address.strip() if body.address else None,
            "p_lines": [{"sku": line.sku.strip(), "quantity": line.quantity, "unit_price": str(line.unit_price), "discount": str(line.discount)} for line in body.lines],
        }).execute().data
        return {"data": result}
    except APIError as exc:
        message = str(exc.message or "")
        if message == "PRODUCT_NOT_FOUND": raise HTTPException(404, "Không tìm thấy sản phẩm hoặc SKU không hợp lệ.") from None
        if message == "INVALID_DISCOUNT": raise HTTPException(422, "Giảm giá không được lớn hơn thành tiền dòng hàng.") from None
        if "create_manual_invoice" in message.lower() or "does not exist" in message.lower() or "schema cache" in message.lower():
            return _create_manual_invoice_legacy(body, user, db)
        raise HTTPException(409, "Không thể lập hóa đơn thủ công.") from None


@router.post("", status_code=201)
def create_invoice(body: InvoiceCreate, user: User = Depends(current_user), db=Depends(get_supabase)):
    _employee(user)
    if db.table("HOA_DON").select("ma_hoadon").eq("ma_donhang", body.order_id).limit(1).execute().data:
        raise HTTPException(409, "Đơn hàng đã được lập hóa đơn.")
    orders = db.table("DON_HANG").select(
        "ma_donhang,trang_thai,ten_nguoi_nhan,dia_chi_chi_tiet"
    ).eq("ma_donhang", body.order_id).limit(1).execute().data
    if not orders:
        raise HTTPException(404, "Không tìm thấy đơn hàng.")
    if orders[0]["trang_thai"] not in {"DA_XUAT_KHO", "HOAN_THANH"}:
        raise HTTPException(409, "Chỉ lập hóa đơn cho đơn đã xuất kho hoặc hoàn thành.")
    lines = db.table("CT_DON_HANG").select(
        "so_luong,don_gia,giam_gia,giam_gia_voucher"
    ).eq("ma_donhang", body.order_id).limit(500).execute().data
    if not lines:
        raise HTTPException(409, "Đơn hàng chưa có sản phẩm.")
    discount = sum((Decimal(str(line.get("giam_gia") or 0)) + Decimal(str(line.get("giam_gia_voucher") or 0)) for line in lines), Decimal(0))
    before_tax = sum((Decimal(str(line["so_luong"])) * Decimal(str(line["don_gia"])) - Decimal(str(line.get("giam_gia") or 0)) - Decimal(str(line.get("giam_gia_voucher") or 0)) for line in lines), Decimal(0))
    tax = _money(before_tax * Decimal("0.10"))
    total = _money(before_tax + tax)
    code = f"HD-{datetime.now(timezone.utc):%Y%m%d}-{uuid4().hex[:6].upper()}"
    row = {
        "ma_hoadon": code, "ma_donhang": body.order_id,
        "thoi_gian_lap": datetime.now(timezone.utc).isoformat(),
        "ten_nguoi_mua": body.buyer or orders[0].get("ten_nguoi_nhan") or "Khách lẻ",
        "ma_so_thue": body.tax_id,
        "dia_chi_nguoi_mua": body.address or orders[0].get("dia_chi_chi_tiet"),
        "tong_tien_giam": str(_money(discount)), "tong_tien_truoc_thue": str(_money(before_tax)),
        "tong_tien_thue": str(tax), "tong_tien_sau_thue": str(total), "nguoi_lap": user.employee_id,
    }
    db.table("HOA_DON").insert(row).execute()
    return {"data": {"id": code, "recordId": body.order_id, "order": body.order_id, "buyer": row["ten_nguoi_mua"], "employeeCode": user.employee_id, "total": f"{total:,.0f} ₫", "created": row["thoi_gian_lap"], "status": "Hoàn tất"}}


@router.get("/{invoice_id}")
def invoice_detail(invoice_id: str, user: User = Depends(current_user), db=Depends(get_supabase)):
    _employee(user)
    try:
        rows = db.table("HOA_DON").select(
            "ma_hoadon,ma_donhang,thoi_gian_lap,ten_nguoi_mua,email_nguoi_mua,ma_so_thue,dia_chi_nguoi_mua,tong_tien_giam,tong_tien_truoc_thue,tong_tien_thue,tong_tien_sau_thue,nguoi_lap"
        ).eq("ma_hoadon", invoice_id).limit(1).execute().data
    except APIError:
        rows = db.table("HOA_DON").select(
            "ma_hoadon,ma_donhang,thoi_gian_lap,ten_nguoi_mua,ma_so_thue,dia_chi_nguoi_mua,tong_tien_giam,tong_tien_truoc_thue,tong_tien_thue,tong_tien_sau_thue,nguoi_lap"
        ).eq("ma_hoadon", invoice_id).limit(1).execute().data
    if not rows:
        raise HTTPException(404, "Không tìm thấy hóa đơn.")
    row = rows[0]
    if not row.get("email_nguoi_mua"):
        order_rows = db.table("DON_HANG").select("ghi_chu").eq("ma_donhang", row["ma_donhang"]).limit(1).execute().data
        note = (order_rows[0].get("ghi_chu") or "") if order_rows else ""
        if note.startswith("EMAIL_HOA_DON:"):
            row["email_nguoi_mua"] = note.removeprefix("EMAIL_HOA_DON:").strip()
    lines = db.table("CT_DON_HANG").select(
        "sku,ten_sp_luc_ban,don_vi_luc_ban,so_luong,don_gia,giam_gia,giam_gia_voucher"
    ).eq("ma_donhang", row["ma_donhang"]).limit(1000).execute().data
    return {"invoice": row, "lines": lines}
