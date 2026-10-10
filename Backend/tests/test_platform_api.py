"""API security/contract tests use real PostgREST query builders, no live secrets."""
import json
from datetime import datetime, timedelta, timezone

import httpx
import jwt
import pytest
from fastapi.testclient import TestClient
from postgrest import SyncPostgrestClient

from app.auth import User, current_user, login_attempts, passwords
from app.main import app
from app.resources import RESOURCES, payload_model, public_columns, schema
from app.supabase import get_supabase

ADMIN = User("TK1", "admin", "ADMIN", "Quản trị", employee_id="NV1")
WAREHOUSE = User("TK2", "kho", "THU_KHO", "Thủ kho", employee_id="NV2", warehouse_id=7)
CUSTOMER = User("TK3", "khach", "KHACH_HANG", "Khách hàng", customer_id="KH3")
ORIGIN = {"Origin": "http://localhost:3000"}


@pytest.fixture
def platform_client(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "test-only-" + "x" * 64)
    state = {"rows": [], "actor": ADMIN, "error": None, "handler": None, "total": 0}
    requests = []
    def handle(request):
        requests.append(request)
        if state["handler"]:
            return state["handler"](request)
        if state["error"]:
            return httpx.Response(400, json=state["error"])
        return httpx.Response(200 if request.method == "GET" else 201, json=state["rows"], headers={"content-range": f"0-0/{state['total']}"})
    with httpx.Client(transport=httpx.MockTransport(handle)) as transport:
        db = SyncPostgrestClient("https://fake.test/rest/v1", http_client=transport)
        app.dependency_overrides[get_supabase] = lambda: db
        app.dependency_overrides[current_user] = lambda: state["actor"]
        login_attempts.clear()
        with TestClient(app) as client:
            yield client, state, requests
        app.dependency_overrides.clear()


def test_health_is_offline():
    with TestClient(app) as client:
        assert client.get("/api/health").json() == {"status": "ok"}


def test_schema_all_tables_and_metadata(platform_client):
    client, _, _ = platform_client
    assert len(schema()) == len(RESOURCES) == 19
    resources = client.get("/api/data/resources").json()
    assert len(resources) == 19
    assert sum(item["writable"] for item in resources) == 8
    accounts = next(item for item in resources if item["name"] == "accounts")
    assert "mat_khau_hash" not in json.dumps(accounts)
    assert accounts["create_schema"] is None


@pytest.mark.parametrize("name", RESOURCES)
def test_admin_can_read_every_table(platform_client, name):
    client, state, requests = platform_client
    state["rows"] = [{"example": "value", "mat_khau_hash": "must-not-leak", "scope": {}}]
    response = client.get(f"/api/data/{name}")
    assert response.status_code == 200
    assert response.json()["data"] == [{"example": "value"}]
    assert requests[-1].url.path.endswith("/" + RESOURCES[name].table)
    assert "*" not in requests[-1].url.params["select"]
    assert "mat_khau_hash" not in requests[-1].url.params["select"]


@pytest.mark.parametrize("name,field", [("warehouses", "ma_kho"), ("inventory", "ma_kho"), ("receipts", "ma_kho"), ("receipt-lines", "scope.ma_kho")])
def test_warehouse_scope(platform_client, name, field):
    client, state, requests = platform_client
    state["actor"] = WAREHOUSE
    assert client.get(f"/api/data/{name}").status_code == 200
    assert requests[-1].url.params[field] == "eq.7"


@pytest.mark.parametrize("name,prefix", [("transfers", ""), ("transfer-lines", "scope.")])
def test_transfer_scope_both_warehouses(platform_client, name, prefix):
    client, state, requests = platform_client
    state["actor"] = WAREHOUSE
    assert client.get(f"/api/data/{name}").status_code == 200
    assert requests[-1].url.params[prefix + "or"] == "(ma_kho_xuat.eq.7,ma_kho_nhan.eq.7)"


@pytest.mark.parametrize("name", ["employees", "accounts", "customers", "orders", "invoices", "payments", "vouchers"])
def test_warehouse_denied(platform_client, name):
    client, state, requests = platform_client
    state["actor"] = WAREHOUSE
    assert client.get(f"/api/data/{name}").status_code == 403
    assert requests == []


@pytest.mark.parametrize("name", ["customers", "orders", "order-lines", "invoices", "payments", "voucher-uses"])
def test_customer_only_owns_records(platform_client, name):
    client, state, requests = platform_client
    state["actor"] = CUSTOMER
    assert client.get(f"/api/data/{name}").status_code == 200
    field = "ma_kh" if name in {"customers", "orders"} else "scope.ma_kh"
    assert requests[-1].url.params[field] == "eq.KH3"
    assert client.post(f"/api/data/{name}", json={}, headers=ORIGIN).status_code == 403


def test_customer_cannot_read_accounts(platform_client):
    client, state, _ = platform_client
    state["actor"] = CUSTOMER
    assert client.get("/api/data/accounts").status_code == 403


def test_transfer_search_cannot_replace_permission_filter(platform_client):
    client, state, requests = platform_client
    state["actor"] = WAREHOUSE
    assert client.get("/api/data/transfers", params={"q": "NHAP"}).status_code == 200
    clause = requests[-1].url.params["or"]
    assert clause.startswith("(and(or(ma_kho_xuat.eq.7,ma_kho_nhan.eq.7),or(")
    assert len(requests[-1].url.params.get_list("or")) == 1


@pytest.mark.parametrize("name", [name for name, resource in RESOURCES.items() if not resource.writable])
def test_no_generic_finance_stock_writes_or_delete(platform_client, name):
    client, _, requests = platform_client
    assert client.post(f"/api/data/{name}", json={}, headers=ORIGIN).status_code == 403
    assert client.patch(f"/api/data/{name}?key=[1]", json={}, headers=ORIGIN).status_code == 403
    assert client.delete(f"/api/data/{name}?key=[1]", headers=ORIGIN).status_code == 405
    assert requests == []


@pytest.mark.parametrize("payload", [{}, {"ma_loai_sp": "CPU", "ten_loai_sp": "CPU", "extra": 1}, {"ma_loai_sp": "CPU", "ten_loai_sp": "   "}])
def test_create_validates_payload(platform_client, payload):
    client, _, requests = platform_client
    assert client.post("/api/data/categories", json=payload, headers=ORIGIN).status_code == 422
    assert not requests


def test_create_category_and_csrf(platform_client):
    client, state, requests = platform_client
    data = {"ma_loai_sp": "CPU", "ten_loai_sp": "CPU"}
    state["rows"] = [data]
    assert client.post("/api/data/categories", json=data).status_code == 403
    assert client.post("/api/data/categories", json=data, headers={"Origin": "https://evil.test"}).status_code == 403
    response = client.post("/api/data/categories", json=data, headers=ORIGIN)
    assert response.status_code == 201
    assert json.loads(requests[-1].content)["trang_thai"] == 1


def test_generic_accounts_cannot_bypass_admin_account_rules(platform_client):
    client, state, requests = platform_client
    state["rows"] = [{"ma_tk": "TKNEW", "mat_khau_hash": "private"}]
    data = {"ma_tk": "TKNEW", "ten_tai_khoan": "new", "ma_kh": "KH1", "password": "test-password-long"}
    response = client.post("/api/data/accounts", json=data, headers=ORIGIN)
    assert response.status_code == 403
    assert client.patch('/api/data/accounts?key=["TK1"]', json={"trang_thai": 0}, headers=ORIGIN).status_code == 403
    assert not requests


def test_immutable_sku_and_partial_update(platform_client):
    client, state, requests = platform_client
    state["rows"] = [{"ma_sp": "SP1", "sku": "SKU1", "ten_sp": "CPU"}]
    assert client.patch('/api/data/products?key=["SP1"]', json={"sku": "NEW"}, headers=ORIGIN).status_code == 422
    response = client.patch('/api/data/products?key=["SP1"]', json={"duong_dan_anh": "https://example.test/cpu.jpg"}, headers=ORIGIN)
    assert response.status_code == 200
    assert json.loads(requests[-1].content) == {"duong_dan_anh": "https://example.test/cpu.jpg"}


@pytest.mark.parametrize("key", [
    '1', '[true]', '[null]', '[{}]', '["one","two"]', '["-900003"]',
    '[-900003.0]', '[2147483648]', '[-2147483649]', '[]', 'not-json',
])
def test_key_validation(platform_client, key):
    client, _, requests = platform_client
    assert client.get("/api/data/warehouses", params={"key": key}).status_code == 422
    assert not requests


INTEGER_KEY_RESOURCES = [
    name for name, resource in RESOURCES.items()
    if any(column["type"] == "int" and column["name"] in resource.keys
           for column in public_columns(name))
]


@pytest.mark.parametrize("name", INTEGER_KEY_RESOURCES)
@pytest.mark.parametrize("value", [-900003, -1, 0, 1, -2147483648, 2147483647])
def test_signed_integer_detail_keys(platform_client, name, value):
    client, state, requests = platform_client
    types = {column["name"]: column["type"] for column in public_columns(name)}
    row = {field: value if types[field] == "int" else "SKU-TEST" for field in RESOURCES[name].keys}
    state["rows"], state["total"] = [row], 1
    key = json.dumps([row[field] for field in RESOURCES[name].keys])
    response = client.get(f"/api/data/{name}", params={"key": key})
    assert response.status_code == 200
    assert response.json()["data"] == [row]
    for field in RESOURCES[name].keys:
        assert requests[-1].url.params[field] == f"eq.{row[field]}"


def test_negative_warehouse_key_can_be_edited(platform_client):
    client, state, requests = platform_client
    state["rows"] = [{"ma_kho": -900003, "ten_kho": "Warehouse test", "dia_chi": "Test", "trang_thai": 1}]
    response = client.patch("/api/data/warehouses", params={"key": "[-900003]"},
                            json={"ten_kho": "Updated warehouse"}, headers=ORIGIN)
    assert response.status_code == 200
    assert [request.method for request in requests] == ["GET", "PATCH"]
    assert all(request.url.params["ma_kho"] == "eq.-900003" for request in requests)
    assert json.loads(requests[-1].content) == {"ten_kho": "Updated warehouse"}


def test_signed_keys_do_not_remove_warehouse_scope(platform_client):
    client, state, requests = platform_client
    state["actor"] = User("TK2", "kho", "THU_KHO", "Warehouse", employee_id="NV2", warehouse_id=-900001)
    response = client.get("/api/data/inventory", params={"key": '[-900003,"SKU-TEST"]'})
    assert response.status_code == 200
    assert requests[-1].url.params.get_list("ma_kho") == ["eq.-900001", "eq.-900003"]
    assert requests[-1].url.params["sku"] == "eq.SKU-TEST"


def test_unknown_table_and_pagination(platform_client):
    client, _, requests = platform_client
    assert client.get("/api/data/pg_authid").status_code == 422
    assert client.get("/api/data/products?page_size=101").status_code == 422
    assert client.get("/api/data/products?page=0").status_code == 422
    assert not requests


def test_search_is_quoted(platform_client):
    client, _, requests = platform_client
    assert client.get("/api/data/products", params={"q": '),trang_thai.eq.0,*'}).status_code == 200
    expression = requests[-1].url.params["or"]
    assert '.imatch."' in expression and "\\" in expression


@pytest.mark.parametrize("code,status", [("23505", 409), ("23503", 422), ("23514", 422), ("PGRST205", 503)])
def test_database_errors_are_safe(platform_client, code, status):
    client, state, _ = platform_client
    state["error"] = {"code": code, "message": "private database secret", "details": "private", "hint": "private"}
    response = client.get("/api/data/products")
    assert response.status_code == status
    assert "private" not in response.text


def configure_login(state):
    account = {"ma_tk": "TK1", "ten_tai_khoan": "admin", "ma_kh": None, "ma_nhan_vien": "NV1", "trang_thai": 1, "mat_khau_hash": passwords.hash("long-test-password")}
    profile = {"ma_nhan_vien": "NV1", "ho_ten": "Admin", "loai_nhan_vien": "ADMIN", "ma_kho": None, "trang_thai": 1}
    def handle(request):
        rows = [account] if request.url.path.endswith("TAI_KHOAN") else [profile]
        return httpx.Response(200, json=rows)
    state["handler"] = handle
    return account, profile


def test_real_login_me_and_cookie(platform_client):
    client, state, _ = platform_client
    account, _ = configure_login(state)
    app.dependency_overrides.pop(current_user)
    response = client.post("/api/auth/login", json={"username": "admin", "password": "long-test-password"}, headers=ORIGIN)
    assert response.status_code == 200
    assert response.json()["role"] == "ADMIN"
    cookie = response.headers["set-cookie"]
    assert "HttpOnly" in cookie and "SameSite=lax" in cookie
    assert "mat_khau_hash" not in response.text
    assert client.get("/api/auth/me").status_code == 200
    account["trang_thai"] = 0
    assert client.get("/api/auth/me").status_code == 401
    account["trang_thai"] = 1
    account["mat_khau_hash"] = passwords.hash("different-password")
    assert client.get("/api/auth/me").status_code == 401


def test_role_reloaded_from_db_and_logout(platform_client):
    client, state, _ = platform_client
    _, profile = configure_login(state)
    app.dependency_overrides.pop(current_user)
    client.post("/api/auth/login", json={"username": "admin", "password": "long-test-password"}, headers=ORIGIN)
    profile["loai_nhan_vien"], profile["ma_kho"] = "THU_KHO", 7
    assert client.get("/api/auth/me").json()["role"] == "THU_KHO"
    assert client.get("/api/data/accounts").status_code == 403
    assert client.post("/api/auth/logout", headers=ORIGIN).status_code == 204
    assert client.get("/api/auth/me").status_code == 401


def test_invalid_login_and_session(platform_client):
    client, state, _ = platform_client
    configure_login(state)
    assert client.post("/api/auth/login", json={"username": "admin", "password": "wrong"}, headers=ORIGIN).status_code == 401
    assert client.post("/api/auth/login", json={"username": "admin", "password": "private" * 100}, headers=ORIGIN).status_code == 422
    app.dependency_overrides.pop(current_user)
    assert client.get("/api/data/accounts").status_code == 401
    client.cookies.set("phub_session", "invalid-token")
    assert client.get("/api/data/accounts").status_code == 401


def test_expired_token(platform_client):
    client, _, _ = platform_client
    app.dependency_overrides.pop(current_user)
    now = datetime.now(timezone.utc)
    token = jwt.encode({"sub": "TK1", "iss": "phub-backend", "aud": "phub-ui", "iat": now - timedelta(days=1), "exp": now - timedelta(hours=1), "ver": "test"}, "test-only-" + "x" * 64, algorithm="HS256")
    client.cookies.set("phub_session", token)
    assert client.get("/api/auth/me").status_code == 401


def test_login_rate_limit(platform_client):
    client, state, _ = platform_client
    configure_login(state)
    # Exhaust the per-IP window without spending time on repeated Argon2 work.
    import time
    login_attempts["testclient"] = (time.monotonic(), 20)
    assert client.post("/api/auth/login", json={"username": "admin", "password": "wrong"}, headers=ORIGIN).status_code == 429


def test_invalid_stored_hash_is_not_a_server_error(platform_client):
    client, state, _ = platform_client
    account, _ = configure_login(state)
    account["mat_khau_hash"] = "invalid-not-a-hash"
    response = client.post("/api/auth/login", json={"username": "admin", "password": "long-test-password"}, headers=ORIGIN)
    assert response.status_code == 401
    assert "invalid-not-a-hash" not in response.text
