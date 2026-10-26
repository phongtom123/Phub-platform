"""Local test identity over the real repositories; never imported by app.main."""
import html
import os
import secrets
import threading
import time
from urllib.parse import urlsplit

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse

from app.catalog.repository import CatalogRepository
from app.catalog.router import get_repository as catalog_repository, router as catalog_router
from app.commerce.repository import CommerceRepository
from app.commerce.router import get_repository as commerce_repository, router as commerce_router
from app.health import router as health_router
from app.orders.repository import OrderRepository
from app.orders.router import get_repository as order_repository, router as order_router
from app.payments.auth import CurrentCustomer, require_customer
from app.payments.errors import PaymentError
from app.payments.repository import PaymentRepository
from app.payments.router import get_repository as payment_repository, router as payment_router

COOKIE = "phub-supabase-test-session"
SESSION_SECONDS = 3600


def local_settings():
    # Guard BEFORE loading credentials or making a database request.
    if os.getenv("PHUB_SUPABASE_TEST_MODE") != "local-only" or any(
        os.getenv(key) for key in ("RENDER", "RENDER_SERVICE_ID", "RENDER_EXTERNAL_URL")
    ):
        raise RuntimeError("Supabase test identity requires explicit local-only mode; forbidden on Render")
    ui = os.getenv("PHUB_SUPABASE_TEST_UI_ORIGIN", "http://127.0.0.1:3001")
    parsed = urlsplit(ui)
    if (parsed.scheme != "http" or parsed.hostname != "127.0.0.1" or parsed.port != 3001
            or parsed.path or parsed.query or parsed.fragment or parsed.username or parsed.password):
        raise RuntimeError("Supabase test UI must be http://127.0.0.1:3001")
    return ui


def create_test_app(client):
    ui = local_settings()
    automatic_customer = os.getenv("PHUB_SUPABASE_TEST_AUTO_CUSTOMER") == "1"
    try:
        rows = client.table("KHACH_HANG").select("ma_kh").order("ma_kh").limit(1).execute().data
        if not rows:
            raise ValueError("No existing customer")
        customer = CurrentCustomer(customer_id=rows[0]["ma_kh"])
    except Exception:
        raise RuntimeError("Cannot select the first existing Supabase customer; check the server connection") from None

    app = FastAPI(title="Phub API — LOCAL Supabase testing (real database)", version="0.1.0")
    for router in (catalog_router, order_router, payment_router, commerce_router, health_router):
        app.include_router(router)
    currency = os.getenv("CATALOG_CURRENCY", "VND")
    app.dependency_overrides[catalog_repository] = lambda: CatalogRepository(
        client, currency=currency, active_status=int(os.getenv("CATALOG_ACTIVE_STATUS", "1")))
    app.dependency_overrides[order_repository] = lambda: OrderRepository(client)
    app.dependency_overrides[commerce_repository] = lambda: CommerceRepository(client)
    app.dependency_overrides[payment_repository] = lambda: PaymentRepository(client, currency)

    lock = threading.Lock()
    sessions = {}

    def identity(request: Request):
        # Only this explicitly guarded loopback app supports automatic identity.
        # app.main never imports it; no client-provided customer ID is trusted.
        if automatic_customer:
            return customer
        token = request.cookies.get(COOKIE, "")
        with lock:
            deadline = sessions.get(token, 0)
            if deadline <= time.monotonic():
                sessions.pop(token, None)
                raise PaymentError(401, "AUTHENTICATION_REQUIRED", "Mở trang phiên test Supabase trên máy này để bắt đầu.")
        return customer

    app.dependency_overrides[require_customer] = identity

    def same_origin(request: Request):
        if (request.headers.get("origin") != str(request.base_url).rstrip("/")
                or request.headers.get("sec-fetch-site") == "cross-site"):
            return False
        return True

    def deny(status, code, message):
        return JSONResponse({"error": {"code": code, "message": message, "details": []}},
                            status_code=status, headers={"Cache-Control": "no-store"})

    @app.middleware("http")
    async def loopback_only(request: Request, call_next):
        if (not request.client or request.client.host not in {"127.0.0.1", "::1"}
                or request.url.hostname not in {"127.0.0.1", "localhost", "::1"}
                or request.headers.get("sec-fetch-site") == "cross-site"):
            return deny(403, "ACCESS_DENIED", "Phiên test Supabase chỉ chạy trên localhost.")
        # Browser API writes are proxied by Next with cookies, but without Origin.
        # Also prevent direct cross-origin API writes reaching this local server.
        if (request.method not in {"GET", "HEAD", "OPTIONS"}
                and request.headers.get("origin")
                and request.headers["origin"] not in {str(request.base_url).rstrip("/"), ui}):
            return deny(403, "ACCESS_DENIED", "Nguồn yêu cầu không hợp lệ.")
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-PHUB-Test-Mode"] = "real-supabase-local"
        response.headers["X-PHUB-Test-Identity"] = "automatic" if automatic_customer else "cookie"
        return response

    @app.get("/__supabase_test", response_class=HTMLResponse, include_in_schema=False)
    def test_home():
        session_controls = (
            '<p><b>Đăng nhập tạm ngắt trong chế độ test local.</b> Mở UI trực tiếp; '
            'backend tự dùng khách cố định, không cần cookie hoặc phiên đăng nhập.</p>'
            '<p><a href="' + ui + '/">Mở giao diện khách hàng</a></p>'
            if automatic_customer else
            '<p>Phiên có hiệu lực 1 giờ.</p>'
            '<form method="post" action="/__supabase_test/enter"><button>Mở UI với khách test</button></form>'
            '<form method="post" action="/__supabase_test/logout"><button>Kết thúc phiên test</button></form>'
        )
        return '''<!doctype html><html lang="vi"><meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>PHUB — test Supabase thật</title>
        <style>body{font-family:Arial,sans-serif;max-width:760px;margin:32px auto;padding:0 20px;line-height:1.65}aside{background:#fff3cf;padding:16px;border-radius:8px}button{padding:12px 18px;cursor:pointer}a{color:#075cad}</style>
        <h1>Giao diện khách hàng · Supabase thật</h1>
        <aside>Catalog, khách hàng, đơn và thanh toán được đọc từ Supabase thật.
        Đặt đơn ghi dữ liệu thật vào database. Đây là phiên khách test local đã được cho phép,
        không kiểm tra mật khẩu và không thay phần đăng nhập của nhóm.</aside>
        <p>Khách cố định: <strong>''' + html.escape(customer.customer_id) + '''</strong>
        (mã đầu tiên khi sắp xếp ma_kh tăng dần).</p>''' + session_controls + '''
        <p>Luồng: mở sản phẩm → thêm giỏ → checkout → nhập người nhận → xác nhận đơn.
        Giá chưa gồm thuế; 10% chỉ áp khi lập hóa đơn. Kho trừ tồn thực khi xuất kho.</p>
        <p>Nếu checkout báo CHECKOUT_DATABASE_NOT_READY, database còn thiếu RPC:
        chạy hai migration theo CUSTOMER-SUPABASE-TESTING.md trước khi đặt đơn.</p>
        <p>Trang này không tạo/sửa/xóa sản phẩm, tồn kho, hóa đơn hoặc thanh toán tự động.</p>
        <p><a href="/docs">Swagger API local</a> · <a href="''' + ui + '''/">Trang chủ UI</a></p></html>'''

    @app.post("/__supabase_test/enter", include_in_schema=False)
    def enter(request: Request):
        if not same_origin(request):
            return deny(403, "ACCESS_DENIED", "Mở trang phiên test local để bắt đầu.")
        if automatic_customer:
            return RedirectResponse(ui + "/", status_code=303)
        token = secrets.token_urlsafe(32)
        now = time.monotonic()
        with lock:
            for expired in [key for key, deadline in sessions.items() if deadline <= now]:
                sessions.pop(expired)
            sessions.pop(request.cookies.get(COOKIE, ""), None)
            sessions[token] = now + SESSION_SECONDS
        response = RedirectResponse(ui + "/", status_code=303)
        response.set_cookie(COOKIE, token, httponly=True, samesite="strict", max_age=SESSION_SECONDS)
        return response

    @app.post("/__supabase_test/logout", include_in_schema=False)
    def logout(request: Request):
        if not same_origin(request):
            return deny(403, "ACCESS_DENIED", "Mở trang phiên test local để kết thúc.")
        if automatic_customer:
            return deny(409, "TEST_LOGIN_DISABLED", "Chế độ test tự dùng khách cố định. Khởi động với -RequireTestSession để kiểm tra đăng nhập/đăng xuất.")
        with lock:
            sessions.pop(request.cookies.get(COOKIE, ""), None)
        response = RedirectResponse(ui + "/", status_code=303)
        response.delete_cookie(COOKIE)
        return response

    return app
