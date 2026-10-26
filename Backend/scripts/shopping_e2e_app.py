"""Isolated browser fixture server. Never imported by app.main or connected to Supabase.

Requires an explicit mode and a local control key; bind ONLY to 127.0.0.1.
Real routers/repositories use a MockTransport. Authentication is simulated here
and cannot certify the other member's password/session implementation.
"""
import json
import os
import secrets
import threading
from copy import deepcopy
from decimal import Decimal

import httpx
from fastapi import FastAPI, HTTPException, Request, Response, Depends
from postgrest import SyncPostgrestClient

from app.catalog.repository import CatalogRepository
from app.catalog.router import get_repository as catalog_repository, router as catalog_router
from app.commerce.repository import CommerceRepository
from app.commerce.router import get_repository as commerce_repository, router as commerce_router
from app.payments.auth import CurrentCustomer, require_customer
from app.payments.repository import PaymentRepository
from app.payments.repository import public_transaction
from app.payments.errors import PaymentError
from app.payments.requests import get_payment_requests
from app.payments.router import get_repository as payment_repository, router as payment_router

CONTROL_KEY = os.getenv("PHUB_E2E_CONTROL_KEY", "")
if os.getenv("PHUB_E2E_MODE") != "isolated-fixtures" or len(CONTROL_KEY) < 32:
    raise RuntimeError("This fixture server requires explicit isolated E2E mode.")

app = FastAPI(title="Isolated shopping fixtures — simulated authentication")
lock = threading.RLock()
sessions = {}
state = {}


def reset():
    state.clear()
    state.update(price="100000.10", stock=5, products_available=True, orders={}, receipts={}, calls=[], transactions={}, profiles={}, invoices={}, payment_requests={}, fail_after_commit=False)


reset()
RECIPIENT = {"name": "Khách thử A", "phone": "0901234567", "address_line": "123 Đường thử", "province": "TP Hồ Chí Minh", "ward": "Phường thử"}


def failure(code):
    return {"error": {"code": code}}


def read_literal(request, key):
    value = request.url.params.get(key, "")
    return value.removeprefix("eq.")


def public_detail(receipt):
    result = {key: receipt[key] for key in ("id", "status", "created_at", "currency", "total", "recipient", "note")}
    result["items"] = [{key: value for key, value in line.items() if key not in {"gross_total", "tax_rate"}} for line in receipt["items"]]
    return result


def checkout(payload):
    owner, body = payload["p_customer_id"], payload["p_request"]
    creating, key = payload["p_create"], payload["p_key"]
    if creating:
        state["calls"].append({"key": key, "body": deepcopy(body), "owner": owner})
        cached = state["receipts"].get(key)
        if cached:
            if cached["owner"] != owner or cached["body"] != body:
                return failure("IDEMPOTENCY_CONFLICT")
            return {"order": cached["receipt"], "replayed": True}
    if not state["products_available"]:
        return failure("PRODUCT_NOT_AVAILABLE")
    if len(body["items"]) != 1 or body["items"][0]["sku"] != "SKU-A":
        return failure("PRODUCT_NOT_AVAILABLE")
    item = body["items"][0]
    reserved = sum(order["items"][0]["quantity"] for order in state["orders"].values())
    if item["quantity"] > state["stock"] - reserved:
        return failure("INSUFFICIENT_STOCK")
    if creating and (item["warehouse_id"] != 1 or item["expected_unit_price"] != state["price"]):
        return failure("PRICE_CHANGED")
    voucher = body.get("voucher_code")
    if voucher not in (None, "SAVE10"):
        return failure("VOUCHER_NOT_AVAILABLE")
    gross = Decimal(state["price"]) * item["quantity"]
    discount = (gross * Decimal("0.10")).quantize(Decimal("0.01")) if voucher else Decimal(0)
    line = {"sku": "SKU-A", "warehouse_id": 1, "name": "Laptop thử nghiệm", "unit": "Chiếc", "quantity": item["quantity"],
            "unit_price": state["price"], "gross_total": format(gross, ".2f"), "discount": format(discount, ".2f"),
            "tax_rate": "10.00", "tax_amount": "0.00", "line_total": format(gross - discount, ".2f")}
    quote = {"currency": "VND", "tax_application": "invoice", "shipping_status": "not_quoted", "voucher_code": voucher,
             "items": [line], "subtotal": line["gross_total"], "discount_total": line["discount"], "tax_total": "0.00", "total": line["line_total"]}
    if not creating:
        return {"quote": quote}
    if body["expected_total"] != quote["total"] or body["expected_discount"] != quote["discount_total"]:
        return failure("CHECKOUT_CHANGED")
    order_id = f"E2E-ORDER-{len(state['orders']) + 1}"
    receipt = {**quote, "id": order_id, "status": "MOI", "sales_channel": "ONLINE", "created_at": "2026-10-06T12:00:00Z", "recipient": body["recipient"], "note": body["note"]}
    state["orders"][order_id] = {**receipt, "owner": owner}
    state["receipts"][key] = {"owner": owner, "body": deepcopy(body), "receipt": deepcopy(receipt)}
    state["transactions"][order_id] = []
    if state["fail_after_commit"]:
        state["fail_after_commit"] = False
        raise httpx.ReadError("Simulated response loss after commit")
    return {"order": receipt, "replayed": False}


def database(request):
    with lock:
        table = request.url.path.rsplit("/", 1)[-1]
        if request.method == "POST":
            payload = json.loads(request.content)
            if table == "customer_checkout_v2":
                return httpx.Response(200, json=checkout(payload))
            if table == "customer_read_orders_v2":
                owned = [order for order in state["orders"].values() if order["owner"] == payload["p_customer_id"]]
                if payload["p_order_id"] is not None:
                    order = next((order for order in owned if order["id"] == payload["p_order_id"]), None)
                    return httpx.Response(200, json={"order": public_detail(order)} if order else failure("ORDER_NOT_FOUND"))
                page, size = payload["p_page"], payload["p_page_size"]
                summaries = [{key: order[key] for key in ("id", "status", "created_at", "currency", "total")} for order in reversed(owned)]
                return httpx.Response(200, json={"items": summaries[(page-1)*size:page*size], "pagination": {"page": page, "page_size": size, "total": len(owned), "total_pages": (len(owned)+size-1)//size}})
            raise RuntimeError("Unexpected fixture RPC")
        rows = []
        if table == "KHACH_HANG":
            owner = read_literal(request, "ma_kh")
            if owner in ("KH-A", "KH-B"):
                row = state["profiles"].setdefault(owner, {"ma_kh": owner, "ten_kh": "Khách thử A" if owner == "KH-A" else "Khách thử B", "sdt": RECIPIENT["phone"], "dia_chi_chi_tiet_md": RECIPIENT["address_line"], "tinh_thanh_md": RECIPIENT["province"], "xa_phuong_md": RECIPIENT["ward"]})
                if request.method == "PATCH":
                    row.update(json.loads(request.content))
                rows = [row]
        elif table == "SAN_PHAM":
            if state["products_available"] and read_literal(request, "ma_sp") in ("", "P-A"):
                rows = [{"ma_sp": "P-A", "sku": "SKU-A", "ten_sp": "Laptop thử nghiệm", "thuong_hieu": "PHUB", "gia_ban_hien_tai": state["price"], "mo_ta": "Mô tả từ API fixture", "thong_so_ky_thuat": "CPU: Core i5\nRAM: 16 GB", "don_vi": "Chiếc", "bao_hanh_thang": 12, "duong_dan_anh": "/images/catalog/product-placeholder.svg", "category": {"ma_loai_sp": "LAPTOP", "ten_loai_sp": "Laptop", "trang_thai": 1}}]
        elif table == "LOAI_SP":
            rows = [{"ma_loai_sp": "LAPTOP", "ten_loai_sp": "Laptop"}]
        elif table == "DON_HANG":
            order = state["orders"].get(read_literal(request, "ma_donhang"))
            if order and order["owner"] == read_literal(request, "ma_kh"):
                rows = [{"ma_donhang": order["id"], "ma_kh": order["owner"], "trang_thai": order["status"], "thoi_gian_dat": order["created_at"]}]
        elif table == "CT_DON_HANG":
            order = state["orders"].get(read_literal(request, "ma_donhang"))
            if order and order["owner"] == read_literal(request, "owned_order.ma_kh"):
                rows = [{"sku": line["sku"], "ma_kho_xuat": line["warehouse_id"], "ten_sp_luc_ban": line["name"], "don_vi_luc_ban": line["unit"],
                    "so_luong": line["quantity"], "don_gia": line["unit_price"], "giam_gia": "0.00", "giam_gia_voucher": line["discount"],
                    "tien_thue": line["tax_amount"], "thanh_tien": line["line_total"],
                    "owned_order": {"ma_donhang": order["id"], "ma_kh": order["owner"]}} for line in order["items"]]
        elif table == "HOA_DON":
            order = state["orders"].get(read_literal(request, "ma_donhang"))
            invoice = state["invoices"].get(read_literal(request, "ma_donhang"))
            if order and invoice and order["owner"] == read_literal(request, "owned_order.ma_kh"):
                rows = [invoice]
        elif table == "THANH_TOAN":
            order = state["orders"].get(read_literal(request, "ma_donhang"))
            if order and order["owner"] == read_literal(request, "owned_order.ma_kh"):
                rows = state["transactions"].get(order["id"], [])
        else:
            raise RuntimeError("Unexpected fixture table")
        total = len(rows)
        offset, limit = int(request.url.params.get("offset", 0)), int(request.url.params.get("limit", 500))
        return httpx.Response(200, json=rows[offset:offset+limit], headers={"content-range": f"{offset}-{offset+max(0,min(limit,total-offset))-1}/{total}"})


transport = httpx.Client(transport=httpx.MockTransport(database))
client = SyncPostgrestClient("https://isolated.test/rest/v1", http_client=transport)
app.include_router(catalog_router)
app.include_router(commerce_router)
app.include_router(payment_router)
app.dependency_overrides[catalog_repository] = lambda: CatalogRepository(client)
app.dependency_overrides[commerce_repository] = lambda: CommerceRepository(client)
app.dependency_overrides[payment_repository] = lambda: PaymentRepository(client)


def fixture_customer(request: Request):
    session = request.cookies.get("phub-e2e-session")
    owner = sessions.get(session)
    if owner is None:
        raise HTTPException(401, "Authentication required")
    return CurrentCustomer(customer_id=owner)


app.dependency_overrides[require_customer] = fixture_customer


@app.middleware("http")
async def local_only(request: Request, call_next):
    if request.client.host not in {"127.0.0.1", "::1", "testclient"}:
        return Response(status_code=403)
    result = await call_next(request)
    if request.url.path == "/api/customer/me":
        result.headers["X-Shopping-Test-Mode"] = "fixtures"
    return result


def control(request):
    if not secrets.compare_digest(request.headers.get("x-e2e-key", ""), CONTROL_KEY):
        raise HTTPException(403)


@app.post("/__e2e/session")
async def session(request: Request, response: Response):
    control(request)
    owner = (await request.json()).get("customer")
    if owner not in {"KH-A", "KH-B", None}:
        raise HTTPException(422)
    if owner is None:
        response.delete_cookie("phub-e2e-session")
    else:
        token = secrets.token_urlsafe(32)
        sessions[token] = owner
        response.set_cookie("phub-e2e-session", token, httponly=True, samesite="strict")
    return {"fixture": True}


@app.post("/__e2e/control")
async def configure(request: Request):
    control(request)
    body = await request.json()
    with lock:
        if body.get("reset"):
            reset()
        for key in ("fail_after_commit", "products_available", "price", "stock"):
            if key in body:
                state[key] = body[key]
        if body.get("missing_address"):
            state["profiles"]["KH-A"] = {"ma_kh": "KH-A", "ten_kh": RECIPIENT["name"], "sdt": RECIPIENT["phone"],
                                           "dia_chi_chi_tiet_md": None, "tinh_thanh_md": None, "xa_phuong_md": None}
        if body.get("payments"):
            order = state["orders"][body["order_id"]]
            state["transactions"][order["id"]] = [{"so_tien": "50000.10", "loai_giao_dich": "HOAN_TIEN" if index == 0 and body["payments"] == "refund" else "THU", "phuong_thuc": "CHUYEN_KHOAN", "trang_thai": "CHO_XU_LY" if index == 0 and body["payments"] != "refund" else "THANH_CONG", "thoi_gian": "2026-10-06T12:00:00", "owned_order": {"ma_donhang": order["id"], "ma_kh": order["owner"]}, "ma_giao_dich": "PRIVATE-REFERENCE", "ma_thanh_toan": "PRIVATE-PAYMENT-ID"} for index in range(11)]
    return {"fixture": True}


@app.get("/__e2e/state")
def inspect(request: Request):
    control(request)
    with lock:
        return {"fixture": True, "orders": len(state["orders"]), "physical_stock": state["stock"], "calls": state["calls"]}


class FixturePaymentRequests:
    def request(self, order_id, customer, method, key):
        with lock:
            owner = customer.customer_id
            order = state["orders"].get(order_id)
            if not order or order["owner"] != owner:
                raise PaymentError(404, "ORDER_NOT_FOUND", "Không tìm thấy đơn hàng thuộc tài khoản của bạn.")
            signature = (order_id, method)
            recorded = state["payment_requests"].get((owner, str(key)))
            if recorded:
                if recorded[0] != signature:
                    raise PaymentError(409, "IDEMPOTENCY_CONFLICT", "Lần yêu cầu thanh toán có nội dung khác.")
                return recorded[1], True
            if any(row["trang_thai"] == "CHO_XU_LY" for row in state["transactions"].get(order_id, [])):
                raise PaymentError(409, "PAYMENT_ALREADY_PENDING", "Đơn đang có yêu cầu thanh toán chờ xử lý.")
            paid = sum((Decimal(row["so_tien"]) * (-1 if row["loai_giao_dich"] == "HOAN_TIEN" else 1)
                        for row in state["transactions"].get(order_id, []) if row["trang_thai"] == "THANH_CONG"), Decimal(0))
            subtotal = Decimal(order["total"])
            tax = (subtotal * Decimal("0.10")).quantize(Decimal("0.01"))
            total = subtotal + tax
            if paid >= total:
                raise PaymentError(409, "ORDER_ALREADY_PAID", "Đơn đã được thanh toán đủ.")
            # Invoice and pending transaction exist only in this in-memory fixture.
            state["invoices"][order_id] = {"thoi_gian_lap": "2026-10-07T12:00:00", "tong_tien_giam": order["discount_total"],
                "tong_tien_truoc_thue": str(subtotal), "tong_tien_thue": str(tax), "tong_tien_sau_thue": str(total),
                "owned_order": {"ma_donhang": order_id, "ma_kh": owner}}
            row = {"so_tien": str(total - paid), "loai_giao_dich": "THU", "phuong_thuc": {"cash":"TIEN_MAT","bank_transfer":"CHUYEN_KHOAN","card":"THE","e_wallet":"VI_DIEN_TU"}[method],
                   "trang_thai": "CHO_XU_LY", "thoi_gian": "2026-10-07T12:00:00", "ma_giao_dich": "PRIVATE-DEMO-REFERENCE", "ma_thanh_toan": "PRIVATE-DEMO-ID",
                   "owned_order": {"ma_donhang": order_id, "ma_kh": owner}}
            state["transactions"].setdefault(order_id, []).insert(0, row)
            result = {"order_id": order_id, "currency": "VND", "latest_transaction": public_transaction(row), "message": "Yêu cầu thanh toán đang chờ xử lý; chưa xác nhận đã trả tiền."}
            state["payment_requests"][(owner, str(key))] = (signature, result)
            return result, False


app.dependency_overrides[get_payment_requests] = lambda: FixturePaymentRequests()


@app.post("/api/orders/{order_id}/demo-payment-state", include_in_schema=False)
async def demo_payment_state(order_id: str, request: Request, customer: CurrentCustomer = Depends(fixture_customer)):
    status = (await request.json()).get("status")
    if status not in {"pending", "succeeded", "failed", "refund"}:
        raise HTTPException(422)
    with lock:
        order = state["orders"].get(order_id)
        transactions = state["transactions"].get(order_id, [])
        if not order or order["owner"] != customer.customer_id:
            raise HTTPException(404)
        if not transactions:
            raise HTTPException(409, "Gửi yêu cầu thanh toán thử trước khi mô phỏng trạng thái.")
        if status == "refund":
            row = {**transactions[0], "loai_giao_dich": "HOAN_TIEN", "trang_thai": "THANH_CONG"}
            transactions.insert(0, row)
        else:
            row = transactions[0]
            if row["loai_giao_dich"] == "HOAN_TIEN":
                row = {**row, "loai_giao_dich": "THU"}
                transactions.insert(0, row)
            row["loai_giao_dich"] = "THU"
            row["trang_thai"] = {"pending":"CHO_XU_LY","succeeded":"THANH_CONG","failed":"THAT_BAI"}[status]
        return {"order_id": order_id, "currency": "VND", "latest_transaction": public_transaction(row).model_dump(mode="json"), "message": public_transaction(row).message}
