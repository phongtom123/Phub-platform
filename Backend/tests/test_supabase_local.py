"""Test local identity isolation with fake transport; never write the real DB."""
import json

import httpx
import pytest
from fastapi.testclient import TestClient
from postgrest import SyncPostgrestClient

from app.payments.auth import require_customer
from app.payments.errors import PaymentError
from scripts.supabase_test_support import COOKIE, create_test_app, local_settings


@pytest.fixture
def local_client(monkeypatch, request):
    monkeypatch.setenv("PHUB_SUPABASE_TEST_MODE", "local-only")
    monkeypatch.setenv("PHUB_SUPABASE_TEST_AUTO_CUSTOMER", "1" if getattr(request, "param", False) else "0")
    monkeypatch.delenv("PHUB_SUPABASE_TEST_UI_ORIGIN", raising=False)
    for key in ("RENDER", "RENDER_SERVICE_ID", "RENDER_EXTERNAL_URL"):
        monkeypatch.delenv(key, raising=False)
    calls = []

    def handle(request):
        calls.append(request)
        if request.method == "GET":
            assert request.url.path.endswith("/KHACH_HANG")
            return httpx.Response(200, json=[{
                "ma_kh": "KH-FIRST", "ten_kh": "Existing customer", "sdt": "0901234567",
                "dia_chi_chi_tiet_md": None, "tinh_thanh_md": None, "xa_phuong_md": None,
            }])
        assert request.url.path.endswith("/customer_checkout_v2")
        return httpx.Response(404, json={"code": "PGRST202", "message": "missing function", "details": None, "hint": None})

    with httpx.Client(transport=httpx.MockTransport(handle)) as transport:
        pg = SyncPostgrestClient("https://local.test/rest/v1", http_client=transport)
        app = create_test_app(pg)
        with TestClient(app, base_url="http://127.0.0.1:8001", client=("127.0.0.1", 12345)) as web:
            yield web, app, calls


def enter(web):
    return web.post("/__supabase_test/enter", headers={"Origin": "http://127.0.0.1:8001"}, follow_redirects=False)


def test_selects_first_existing_customer_without_writing(local_client):
    web, _, calls = local_client
    assert calls[0].method == "GET"
    assert calls[0].url.params["select"] == "ma_kh"
    assert calls[0].url.params["order"] == "ma_kh.asc"
    assert calls[0].url.params["limit"] == "1"
    control = web.get("/__supabase_test")
    assert "KH-FIRST" in control.text and "Supabase thật" in control.text
    assert control.headers["cache-control"] == "no-store"
    assert len(calls) == 1


def test_guest_forged_token_and_client_customer_id_do_not_grant_access(local_client):
    web, _, calls = local_client
    web.cookies.set(COOKIE, "forged")
    response = web.get("/api/customer/me", headers={"Authorization": "Bearer forged", "X-Customer-Id": "KH-OTHER"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTHENTICATION_REQUIRED"
    assert len(calls) == 1


def test_session_uses_fixed_server_identity_and_real_repository(local_client):
    web, _, calls = local_client
    result = enter(web)
    assert result.status_code == 303 and result.headers["location"] == "http://127.0.0.1:3001/"
    cookie = result.headers["set-cookie"]
    assert "HttpOnly" in cookie and "SameSite=strict" in cookie and "Max-Age=3600" in cookie
    assert "KH-FIRST" not in web.cookies.get(COOKIE)
    result = web.get("/api/customer/me", headers={"X-Customer-Id": "KH-OTHER"})
    assert result.status_code == 200 and result.json()["customer_id"] == "KH-FIRST"
    assert calls[-1].url.params["ma_kh"] == 'eq.KH-FIRST'
    result = web.post("/api/customer/checkout/quote", json={"items": [{"sku": "SKU", "quantity": 1}]})
    assert result.status_code == 503 and result.json()["error"]["code"] == "CHECKOUT_DATABASE_NOT_READY"
    payload = json.loads(calls[-1].content)
    assert payload["p_customer_id"] == "KH-FIRST" and payload["p_create"] is False


def test_reentry_and_logout_revoke_previous_cookie(local_client):
    web, _, _ = local_client
    enter(web)
    old = web.cookies.get(COOKIE)
    enter(web)
    new = web.cookies.get(COOKIE)
    assert old != new
    assert web.get("/api/customer/me", headers={"Cookie": f"{COOKIE}={old}"}).status_code == 401
    result = web.post("/__supabase_test/logout", headers={"Origin": "http://127.0.0.1:8001"}, follow_redirects=False)
    assert result.status_code == 303
    assert web.get("/api/customer/me", headers={"Cookie": f"{COOKIE}={new}"}).status_code == 401


def test_session_expires_on_server(local_client, monkeypatch):
    web, _, _ = local_client
    monkeypatch.setattr("scripts.supabase_test_support.time.monotonic", lambda: 100)
    enter(web)
    monkeypatch.setattr("scripts.supabase_test_support.time.monotonic", lambda: 3701)
    assert web.get("/api/customer/me").status_code == 401


@pytest.mark.parametrize("headers", [{}, {"Origin": "https://evil.example"}, {"Origin": "http://127.0.0.1:8001", "Sec-Fetch-Site": "cross-site"}])
def test_browser_cannot_create_test_session_cross_site(local_client, headers):
    web, _, _ = local_client
    result = web.post("/__supabase_test/enter", headers=headers, follow_redirects=False)
    assert result.status_code == 403 and COOKIE not in result.headers.get("set-cookie", "")


@pytest.mark.parametrize("host,client_ip", [("evil.example", "127.0.0.1"), ("127.0.0.1", "10.0.0.2")])
def test_server_rejects_remote_clients_and_hosts(local_client, host, client_ip):
    _, app, _ = local_client
    with TestClient(app, base_url=f"http://{host}:8001", client=(client_ip, 12345)) as web:
        assert web.get("/__supabase_test").status_code == 403


@pytest.mark.parametrize("flag", ["RENDER", "RENDER_SERVICE_ID", "RENDER_EXTERNAL_URL"])
def test_cannot_enable_this_identity_on_render(local_client, monkeypatch, flag):
    monkeypatch.setenv(flag, "present")
    with pytest.raises(RuntimeError, match="forbidden on Render"):
        local_settings()


def test_explicit_local_mode_required_before_database_read(monkeypatch):
    monkeypatch.delenv("PHUB_SUPABASE_TEST_MODE", raising=False)
    with pytest.raises(RuntimeError, match="local-only"):
        create_test_app(None)


def test_local_override_does_not_change_production_auth(local_client):
    web, _, _ = local_client
    enter(web)
    assert web.get("/api/customer/me").status_code == 200
    with pytest.raises(PaymentError) as exc:
        require_customer()
    assert exc.value.code == "AUTH_INTEGRATION_REQUIRED"
    assert "/__supabase_test" not in web.get("/openapi.json").json()["paths"]


@pytest.mark.parametrize("local_client", [True], indirect=True)
def test_automatic_customer_works_without_cookie_and_ignores_forged_identity(local_client):
    web, _, calls = local_client
    result = web.get("/api/customer/me", headers={"X-Customer-Id": "KH-OTHER", "Authorization": "Bearer forged"})
    assert result.status_code == 200 and result.json()["customer_id"] == "KH-FIRST"
    assert result.headers["x-phub-test-identity"] == "automatic"
    assert calls[-1].url.params["ma_kh"] == "eq.KH-FIRST"
    assert COOKIE not in web.cookies
    quote = web.post("/api/customer/checkout/quote", json={"items": [{"sku": "SKU", "quantity": 1}]})
    assert quote.status_code == 503 and quote.json()["error"]["code"] == "CHECKOUT_DATABASE_NOT_READY"
    assert json.loads(calls[-1].content)["p_customer_id"] == "KH-FIRST"
    assert "Đăng nhập tạm ngắt" in web.get("/__supabase_test").text


@pytest.mark.parametrize("local_client", [True], indirect=True)
def test_automatic_mode_does_not_offer_misleading_logout_or_change_production_auth(local_client):
    web, _, _ = local_client
    result = web.post("/__supabase_test/logout", headers={"Origin": "http://127.0.0.1:8001"})
    assert result.status_code == 409 and result.json()["error"]["code"] == "TEST_LOGIN_DISABLED"
    assert web.get("/api/customer/me").status_code == 200
    with pytest.raises(PaymentError) as exc:
        require_customer()
    assert exc.value.code == "AUTH_INTEGRATION_REQUIRED"


@pytest.mark.parametrize("local_client", [True], indirect=True)
@pytest.mark.parametrize("host,client_ip", [("evil.example", "127.0.0.1"), ("127.0.0.1", "10.0.0.2")])
def test_automatic_customer_is_still_blocked_outside_loopback(local_client, host, client_ip):
    _, app, _ = local_client
    with TestClient(app, base_url=f"http://{host}:8001", client=(client_ip, 12345)) as web:
        assert web.get("/api/customer/me").status_code == 403
