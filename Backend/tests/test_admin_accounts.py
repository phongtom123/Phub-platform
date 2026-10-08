"""Account API contracts with real PostgREST builders and an offline HTTP store."""
import json
import time
from copy import deepcopy

import httpx
import pytest
from fastapi.testclient import TestClient
from postgrest import SyncPostgrestClient

from app.auth import User, current_user, login_attempts, passwords
from app.main import app
from app.supabase import get_supabase

ORIGIN = {"Origin": "http://localhost:3000"}
ADMIN = User("TK1", "Admin.One", "ADMIN", "Admin", employee_id="NV1")
PASSWORD = "test-only-password"
OPERATIONS = [
    ("GET", "/accounts", None), ("GET", "/account-owners", None),
    ("POST", "/accounts", {"ma_tk": "TK4", "ten_tai_khoan": "new.account", "ma_kh": "KH2", "password": PASSWORD}),
    ("GET", "/accounts/TK2", None), ("PATCH", "/accounts/TK2", {"email": None}),
    ("POST", "/accounts/TK2/status", {"trang_thai": 2}),
    ("PUT", "/accounts/TK2/role", {"role": "ADMIN", "ma_kho": None}),
    ("POST", "/accounts/TK2/password", {"password": PASSWORD}),
    ("GET", "/me", None), ("PATCH", "/me", {"email": None}),
    ("POST", "/me/password", {"current_password": PASSWORD, "password": "new-test-password"}),
]


@pytest.fixture
def accounts_client(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "test-only-" + "x" * 64)
    monkeypatch.setenv("FRONTEND_ORIGINS", "http://localhost:3000")
    monkeypatch.setenv("COOKIE_SECURE", "false")
    old_hash = passwords.hash(PASSWORD)
    tables = {
        "TAI_KHOAN": [
            {"ma_tk": "TK1", "ten_tai_khoan": "Admin.One", "email": "admin@example.test", "ma_nhan_vien": "NV1", "ma_kh": None, "trang_thai": 1, "mat_khau_hash": old_hash},
            {"ma_tk": "TK2", "ten_tai_khoan": "warehouse", "email": None, "ma_nhan_vien": "NV2", "ma_kh": None, "trang_thai": 1, "mat_khau_hash": old_hash},
            {"ma_tk": "TK3", "ten_tai_khoan": "customer", "email": None, "ma_nhan_vien": None, "ma_kh": "KH1", "trang_thai": 1, "mat_khau_hash": old_hash},
        ],
        "NHAN_VIEN": [
            {"ma_nhan_vien": "NV1", "ho_ten": "Admin", "loai_nhan_vien": "ADMIN", "ma_kho": None, "trang_thai": 1},
            {"ma_nhan_vien": "NV2", "ho_ten": "Warehouse", "loai_nhan_vien": "THU_KHO", "ma_kho": 7, "trang_thai": 1},
            {"ma_nhan_vien": "NV3", "ho_ten": "New employee", "loai_nhan_vien": "ADMIN", "ma_kho": None, "trang_thai": 1},
        ],
        "KHACH_HANG": [{"ma_kh": "KH1", "ten_kh": "Customer"}, {"ma_kh": "KH2", "ten_kh": "New customer"}],
        "KHO": [{"ma_kho": 7, "trang_thai": 1}, {"ma_kho": 8, "trang_thai": 0}],
    }
    requests = []
    state = {"actor": ADMIN, "conflict": False}

    def handle(request):
        requests.append(request)
        table = request.url.path.split("/")[-1]
        rows = tables[table]
        params = request.url.params
        matching = []
        for row in rows:
            matched = True
            for field, condition in params.multi_items():
                if field == "employee.loai_nhan_vien":
                    profile = next((p for p in tables["NHAN_VIEN"] if p["ma_nhan_vien"] == row.get("ma_nhan_vien")), {})
                    value = profile.get("loai_nhan_vien")
                else:
                    value = row.get(field)
                if condition.startswith("eq.") and str(value) != condition[3:]:
                    matched = False
                if condition == "not.is.null" and value is None:
                    matched = False
            if matched:
                matching.append(row)
        if request.method == "POST":
            body = json.loads(request.content)
            if state["conflict"]:
                return httpx.Response(409, json={"code": "23505", "message": "private SQL details", "details": "private", "hint": None})
            tables[table].append(body)
            return httpx.Response(201, json=[body])
        if request.method == "PATCH":
            body = json.loads(request.content)
            for row in matching:
                row.update(body)
            return httpx.Response(200, json=matching)
        total = len(matching)
        offset = int(params.get("offset", 0))
        limit = int(params.get("limit", total or 1))
        selected = deepcopy(matching[offset:offset + limit])
        for row in selected:
            if "employee:NHAN_VIEN" in params.get("select", ""):
                row["employee"] = next((p for p in tables["NHAN_VIEN"] if p["ma_nhan_vien"] == row.get("ma_nhan_vien")), None)
                row["customer"] = next((p for p in tables["KHACH_HANG"] if p["ma_kh"] == row.get("ma_kh")), None)
            if "account:TAI_KHOAN" in params.get("select", ""):
                key = "ma_nhan_vien" if table == "NHAN_VIEN" else "ma_kh"
                row["account"] = [{"ma_tk": a["ma_tk"]} for a in tables["TAI_KHOAN"] if a.get(key) == row[key]]
        return httpx.Response(200, json=selected, headers={"Content-Range": f"{offset}-{offset + len(selected) - 1}/{total}"})

    with httpx.Client(transport=httpx.MockTransport(handle)) as transport:
        db = SyncPostgrestClient("https://offline.test/rest/v1", http_client=transport)
        app.dependency_overrides[get_supabase] = lambda: db
        app.dependency_overrides[current_user] = lambda: state["actor"]
        login_attempts.clear()
        with TestClient(app) as client:
            yield client, tables, requests, state
        app.dependency_overrides.clear()
        login_attempts.clear()


@pytest.mark.parametrize("method,path,body", OPERATIONS)
@pytest.mark.parametrize("role", ["THU_KHO", "KHACH_HANG"])
def test_admin_only(accounts_client, method, path, body, role):
    client, _, requests, state = accounts_client
    state["actor"] = User("other", "other", role, "Other")
    assert client.request(method, "/api/admin" + path, json=body, headers=ORIGIN).status_code == 403
    assert not requests


@pytest.mark.parametrize("method,path,body", OPERATIONS)
def test_cookie_required(accounts_client, method, path, body):
    client, _, requests, _ = accounts_client
    app.dependency_overrides.pop(current_user)
    assert client.request(method, "/api/admin" + path, json=body, headers=ORIGIN).status_code == 401
    assert not requests


@pytest.mark.parametrize("method,path,body", [op for op in OPERATIONS if op[0] != "GET"])
@pytest.mark.parametrize("headers", [{}, {"Origin": "https://evil.test"}])
def test_csrf_before_any_mutation(accounts_client, method, path, body, headers):
    client, _, requests, _ = accounts_client
    assert client.request(method, "/api/admin" + path, json=body, headers=headers).status_code == 403
    assert not requests


def test_list_filters_pagination_projection_and_search(accounts_client):
    client, _, requests, _ = accounts_client
    response = client.get("/api/admin/accounts", params={"role": "THU_KHO", "status": 1, "q": '),email.eq.secret,*', "page_size": 1})
    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["data"][0]["ma_tk"] == "TK2"
    assert response.headers["Cache-Control"] == "no-store"
    params = requests[-1].url.params
    assert params["employee.loai_nhan_vien"] == "eq.THU_KHO"
    assert "NHAN_VIEN!inner" in params["select"]
    assert '.imatch."' in params["or"] and "\\" in params["or"]
    assert all(field not in params["select"] for field in ["mat_khau_hash", "luong", "cccd"])
    assert "mat_khau_hash" not in response.text
    customer = client.get("/api/admin/accounts?role=KHACH_HANG").json()["data"]
    assert [row["ma_tk"] for row in customer] == ["TK3"]
    assert requests[-1].url.params["ma_kh"] == "not.is.null"
    assert client.get("/api/admin/accounts?page=2&page_size=2").json()["data"][0]["ma_tk"] == "TK3"
    assert client.get("/api/admin/accounts?page=0").status_code == 422
    assert client.get("/api/admin/accounts?page_size=101").status_code == 422
    assert client.get("/api/admin/accounts?role=ROOT").status_code == 422
    assert client.get("/api/admin/accounts?status=3").status_code == 422


def test_detail_me_and_owners(accounts_client):
    client, _, requests, _ = accounts_client
    assert client.get("/api/admin/me").json()["is_self"] is True
    assert client.get("/api/admin/accounts/TK3").json()["role"] == "KHACH_HANG"
    assert client.get("/api/admin/accounts/missing").status_code == 404
    owners = client.get("/api/admin/account-owners?kind=employees").json()["data"]
    assert [row["has_account"] for row in owners] == [True, True, False]
    assert "account:TAI_KHOAN(ma_tk)" in requests[-1].url.params["select"]
    assert client.get("/api/admin/account-owners?kind=customers").json()["data"][1]["has_account"] is False


@pytest.mark.parametrize("kind,owner,role", [("ma_nhan_vien", "NV3", "ADMIN"), ("ma_kh", "KH2", "KHACH_HANG")])
def test_create_hashes_password_and_derives_role(accounts_client, kind, owner, role):
    client, tables, requests, _ = accounts_client
    body = {"ma_tk": "TK4", "ten_tai_khoan": " New.User ", "email": " New@Example.Test ", kind: owner, "password": "  test-password-space  "}
    response = client.post("/api/admin/accounts", json=body, headers=ORIGIN)
    assert response.status_code == 201
    assert response.json()["role"] == role
    assert response.json()["email"] == "new@example.test"
    assert response.json()["ten_tai_khoan"] == "New.User"
    assert "mat_khau_hash" not in response.text and body["password"] not in response.text
    stored = tables["TAI_KHOAN"][-1]
    assert stored["trang_thai"] == 1
    assert stored["mat_khau_hash"].startswith("$argon2")
    assert passwords.verify(body["password"], stored["mat_khau_hash"])
    assert len([r for r in requests if r.method != "GET"]) == 1


@pytest.mark.parametrize("changes", [
    {"ma_kh": None}, {"ma_nhan_vien": "NV3"}, {"password": "tiny"}, {"role": "ADMIN"},
    {"mat_khau_hash": "fake"}, {"trang_thai": 2}, {"ten_tai_khoan": "user@host"},
    {"email": "invalid"}, {"ma_tk": ".."}, {"ma_tk": "."}, {"ma_tk": "new"},
])
def test_invalid_create_never_writes_or_echoes_password(accounts_client, changes):
    client, _, requests, _ = accounts_client
    body = {"ma_tk": "TK4", "ten_tai_khoan": "user4", "ma_kh": "KH2", "password": PASSWORD} | changes
    response = client.post("/api/admin/accounts", json=body, headers=ORIGIN)
    assert response.status_code == 422
    assert not requests
    assert body["password"] not in response.text


@pytest.mark.parametrize("owner,status", [("missing", 422), ("KH1", 409)])
def test_invalid_or_used_owner(accounts_client, owner, status):
    client, _, requests, _ = accounts_client
    assert client.post("/api/admin/accounts", json={"ma_tk": "TK4", "ten_tai_khoan": "user4", "ma_kh": owner, "password": PASSWORD}, headers=ORIGIN).status_code == status
    assert all(r.method == "GET" for r in requests)


def test_inactive_owner_and_warehouse(accounts_client):
    client, tables, requests, _ = accounts_client
    payload = {"ma_tk": "TK4", "ten_tai_khoan": "user4", "ma_nhan_vien": "NV3", "password": PASSWORD}
    tables["NHAN_VIEN"][2]["trang_thai"] = 0
    assert client.post("/api/admin/accounts", json=payload, headers=ORIGIN).status_code == 422
    tables["NHAN_VIEN"][2].update(trang_thai=1, loai_nhan_vien="THU_KHO", ma_kho=8)
    assert client.post("/api/admin/accounts", json=payload, headers=ORIGIN).status_code == 422
    assert all(r.method == "GET" for r in requests)


def test_unique_conflict_is_safe(accounts_client):
    client, _, _, state = accounts_client
    state["conflict"] = True
    response = client.post("/api/admin/accounts", json=OPERATIONS[2][2], headers=ORIGIN)
    assert response.status_code == 409 and "private" not in response.text


@pytest.mark.parametrize("body", [{}, {"ma_tk": "OTHER"}, {"ma_nhan_vien": "NV3"}, {"password": PASSWORD}, {"trang_thai": 2}, {"role": "ADMIN"}, {"ten_tai_khoan": None}])
def test_edit_only_username_and_email(accounts_client, body):
    client, _, requests, _ = accounts_client
    assert client.patch("/api/admin/accounts/TK2", json=body, headers=ORIGIN).status_code == 422
    assert not requests


def test_edit_and_clear_email(accounts_client):
    client, tables, _, _ = accounts_client
    result = client.patch("/api/admin/me", json={"ten_tai_khoan": "Updated.Admin", "email": None}, headers=ORIGIN)
    assert result.status_code == 200 and result.json()["email"] is None
    assert tables["TAI_KHOAN"][0]["ten_tai_khoan"] == "Updated.Admin"
    assert tables["TAI_KHOAN"][0]["ma_nhan_vien"] == "NV1"


@pytest.mark.parametrize("status", [0, 1, 2])
def test_status_and_self_guard(accounts_client, status):
    client, tables, _, _ = accounts_client
    response = client.post("/api/admin/accounts/TK2/status", json={"trang_thai": status}, headers=ORIGIN)
    assert response.status_code == 200 and tables["TAI_KHOAN"][1]["trang_thai"] == status
    self_response = client.post("/api/admin/accounts/TK1/status", json={"trang_thai": status}, headers=ORIGIN)
    assert self_response.status_code == (200 if status == 1 else 409)
    assert tables["TAI_KHOAN"][0]["trang_thai"] == 1
    assert client.delete("/api/admin/accounts/TK2", headers=ORIGIN).status_code == 405


@pytest.mark.parametrize("status", [True, "1", -1, 3])
def test_strict_status(accounts_client, status):
    client, _, requests, _ = accounts_client
    assert client.post("/api/admin/accounts/TK2/status", json={"trang_thai": status}, headers=ORIGIN).status_code == 422
    assert not requests


def test_employee_role_assignment_and_customer_guard(accounts_client):
    client, tables, _, _ = accounts_client
    result = client.put("/api/admin/accounts/TK2/role", json={"role": "ADMIN", "ma_kho": None}, headers=ORIGIN)
    assert result.status_code == 200 and result.json()["role"] == "ADMIN" and result.json()["ma_kho"] is None
    result = client.put("/api/admin/accounts/TK2/role", json={"role": "THU_KHO", "ma_kho": 7}, headers=ORIGIN)
    assert result.status_code == 200 and tables["NHAN_VIEN"][1]["ma_kho"] == 7
    assert client.put("/api/admin/accounts/TK3/role", json={"role": "ADMIN"}, headers=ORIGIN).status_code == 422
    assert client.put("/api/admin/accounts/TK1/role", json={"role": "THU_KHO", "ma_kho": 7}, headers=ORIGIN).status_code == 409
    for body in [{"role": "ADMIN", "ma_kho": 7}, {"role": "THU_KHO"}, {"role": "THU_KHO", "ma_kho": 8}, {"role": "THU_KHO", "ma_kho": 999}, {"role": "KHACH_HANG"}]:
        assert client.put("/api/admin/accounts/TK2/role", json=body, headers=ORIGIN).status_code == 422


@pytest.mark.parametrize("body", [{"trang_thai": 0}, {"loai_nhan_vien": "THU_KHO", "ma_kho": 7}])
def test_generic_employee_api_cannot_bypass_self_guard(accounts_client, body):
    client, _, requests, _ = accounts_client
    assert client.patch('/api/data/employees?key=["NV1"]', json=body, headers=ORIGIN).status_code == 409
    assert all(r.method == "GET" for r in requests)


def test_reset_password_invalidates_old_token(accounts_client):
    client, tables, _, _ = accounts_client
    app.dependency_overrides.pop(current_user)
    assert client.post("/api/auth/login", json={"username": "warehouse", "password": PASSWORD}, headers=ORIGIN).status_code == 200
    old_token = client.cookies.get("phub_session")
    app.dependency_overrides[current_user] = lambda: ADMIN
    result = client.post("/api/admin/accounts/TK2/password", json={"password": "replacement-password"}, headers=ORIGIN)
    assert result.status_code == 200 and "mat_khau_hash" not in result.text
    assert passwords.verify("replacement-password", tables["TAI_KHOAN"][1]["mat_khau_hash"])
    assert client.post("/api/admin/accounts/TK1/password", json={"password": "replacement-password"}, headers=ORIGIN).status_code == 409
    app.dependency_overrides.pop(current_user)
    client.cookies.clear(); client.cookies.set("phub_session", old_token)
    assert client.get("/api/auth/me").status_code == 401
    assert client.post("/api/auth/login", json={"username": "warehouse", "password": "replacement-password"}, headers=ORIGIN).status_code == 200


def test_self_password_current_verification_cas_and_logout(accounts_client):
    client, tables, requests, _ = accounts_client
    app.dependency_overrides.pop(current_user)
    assert client.post("/api/auth/login", json={"username": "ADMIN@EXAMPLE.TEST", "password": PASSWORD}, headers=ORIGIN).status_code == 200
    assert requests[0].url.params["email"] == "eq.admin@example.test"
    old_token = client.cookies.get("phub_session")
    old_hash = tables["TAI_KHOAN"][0]["mat_khau_hash"]
    body = {"current_password": "wrong", "password": "replacement-password"}
    assert client.post("/api/admin/me/password", json=body, headers=ORIGIN).status_code == 422
    assert tables["TAI_KHOAN"][0]["mat_khau_hash"] == old_hash
    body["current_password"] = PASSWORD
    response = client.post("/api/admin/me/password", json=body, headers=ORIGIN)
    assert response.status_code == 200 and "Max-Age=0" in response.headers["Set-Cookie"]
    patch = next(r for r in requests if r.method == "PATCH")
    assert patch.url.params["mat_khau_hash"] == "eq." + old_hash
    assert passwords.verify(body["password"], tables["TAI_KHOAN"][0]["mat_khau_hash"])
    assert client.get("/api/auth/me").status_code == 401
    client.cookies.clear(); client.cookies.set("phub_session", old_token)
    assert client.get("/api/auth/me").status_code == 401


def test_lock_unlock_and_role_refresh_enforced_by_real_session(accounts_client):
    client, _, _, _ = accounts_client
    app.dependency_overrides.pop(current_user)
    client.post("/api/auth/login", json={"username": "warehouse", "password": PASSWORD}, headers=ORIGIN)
    app.dependency_overrides[current_user] = lambda: ADMIN
    client.post("/api/admin/accounts/TK2/status", json={"trang_thai": 2}, headers=ORIGIN)
    app.dependency_overrides.pop(current_user)
    assert client.get("/api/auth/me").status_code == 401
    app.dependency_overrides[current_user] = lambda: ADMIN
    client.post("/api/admin/accounts/TK2/status", json={"trang_thai": 1}, headers=ORIGIN)
    client.put("/api/admin/accounts/TK2/role", json={"role": "ADMIN"}, headers=ORIGIN)
    app.dependency_overrides.pop(current_user)
    assert client.get("/api/admin/me").status_code == 200
    assert client.get("/api/auth/me").json()["role"] == "ADMIN"


def test_current_password_is_rate_limited(accounts_client):
    client, _, requests, _ = accounts_client
    login_attempts["testclient"] = (time.monotonic(), 20)
    assert client.post("/api/admin/me/password", json={"current_password": PASSWORD, "password": "replacement-password"}, headers=ORIGIN).status_code == 429
    assert not requests


def test_openapi_documents_admin_security_without_password_read_fields():
    spec = app.openapi()
    for method, path, _ in OPERATIONS:
        path = path.replace("/TK2", "/{account_id}")
        operation = spec["paths"]["/api/admin" + path][method.lower()]
        assert operation["security"] == [{"SessionCookie": []}]
        assert operation["x-roles"] == ["ADMIN"]
        if method != "GET":
            assert any(p["name"] == "Origin" for p in operation["parameters"])
    properties = spec["components"]["schemas"]["AccountRead"]["properties"]
    assert "mat_khau_hash" not in properties and "password" not in properties
    assert spec["components"]["schemas"]["AccountCreate"]["properties"]["password"]["writeOnly"] is True
