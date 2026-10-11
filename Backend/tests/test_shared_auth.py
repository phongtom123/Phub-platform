import json

import httpx
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from postgrest import SyncPostgrestClient

from app.auth import (
    User,
    current_user,
    passwords,
    registration_attempts,
    require_admin,
    require_customer_user,
    require_warehouse,
    router as auth_router,
)
from app.payments.auth import CurrentCustomer, require_customer
from app.supabase import get_supabase


def build_client(actor: User) -> TestClient:
    app = FastAPI()

    @app.get("/admin")
    def admin(user: User = Depends(require_admin)):
        return {"role": user.role}

    @app.get("/warehouse")
    def warehouse(user: User = Depends(require_warehouse)):
        return {"warehouse_id": user.warehouse_id}

    @app.get("/customer")
    def customer(identity: CurrentCustomer = Depends(require_customer)):
        return {"customer_id": identity.customer_id}

    app.dependency_overrides[current_user] = lambda: actor
    return TestClient(app)


def test_shared_role_guards_allow_only_the_matching_portal():
    admin = build_client(User("TK1", "admin", "ADMIN", "Admin", employee_id="NV1"))
    assert admin.get("/admin").status_code == 200
    assert admin.get("/warehouse").status_code == 403
    assert admin.get("/customer").status_code == 403

    warehouse = build_client(User(
        "TK2", "warehouse", "THU_KHO", "Warehouse",
        employee_id="NV2", warehouse_id=7,
    ))
    assert warehouse.get("/admin").status_code == 403
    assert warehouse.get("/warehouse").json() == {"warehouse_id": 7}
    assert warehouse.get("/customer").status_code == 403

    customer = build_client(User(
        "TK3", "customer", "KHACH_HANG", "Customer", customer_id="KH3",
    ))
    assert customer.get("/admin").status_code == 403
    assert customer.get("/warehouse").status_code == 403
    assert customer.get("/customer").json() == {"customer_id": "KH3"}


def test_warehouse_guard_requires_an_assigned_warehouse():
    client = build_client(User(
        "TK2", "warehouse", "THU_KHO", "Warehouse", employee_id="NV2",
    ))
    assert client.get("/warehouse").status_code == 403


def test_customer_login_cookie_flows_through_the_shared_dependency(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "test-only-" + "x" * 64)
    account = {
        "ma_tk": "TK3", "ten_tai_khoan": "customer", "ma_kh": "KH3",
        "ma_nhan_vien": None, "trang_thai": 1,
        "mat_khau_hash": passwords.hash("customer-password"),
    }

    def handle(request):
        if request.url.path.endswith("/TAI_KHOAN"):
            return httpx.Response(200, json=[account])
        return httpx.Response(200, json=[{"ma_kh": "KH3", "ten_kh": "Customer"}])

    with httpx.Client(transport=httpx.MockTransport(handle)) as transport:
        db = SyncPostgrestClient("https://auth.test/rest/v1", http_client=transport)
        app = FastAPI()
        app.include_router(auth_router)

        @app.get("/customer")
        def customer(identity: CurrentCustomer = Depends(require_customer)):
            return {"customer_id": identity.customer_id}

        app.dependency_overrides[get_supabase] = lambda: db
        with TestClient(app) as client:
            login = client.post(
                "/api/auth/login",
                json={"username": "customer", "password": "customer-password"},
                headers={"Origin": "http://localhost:3000"},
            )
            assert login.status_code == 200
            assert login.json()["role"] == "KHACH_HANG"
            assert "HttpOnly" in login.headers["set-cookie"]
            assert client.get("/customer").json() == {"customer_id": "KH3"}


def test_customer_registration_is_atomic_and_starts_a_session(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "test-only-" + "x" * 64)
    registration_attempts.clear()
    state = {}

    def handle(request):
        if request.url.path.endswith("/rpc/customer_register_v1"):
            payload = json.loads(request.content)
            state.update(payload)
            assert payload["p_customer_id"].startswith("KH_")
            assert payload["p_email"] == "customer@example.com"
            assert payload["p_name"] == "Customer Name"
            assert payload["p_phone"] == "0901234567"
            assert passwords.verify("customer-password", payload["p_password_hash"])
            return httpx.Response(200, json={
                "account_id": "KH000001", "username": "customer", "role": "KHACH_HANG",
                "name": "Customer Name", "customer_id": payload["p_customer_id"],
                "employee_id": None, "warehouse_id": None,
            })
        if request.url.path.endswith("/TAI_KHOAN"):
            return httpx.Response(200, json=[{
                "ma_tk": "KH000001", "ten_tai_khoan": "customer",
                "ma_kh": state["p_customer_id"], "ma_nhan_vien": None, "trang_thai": 1,
                "mat_khau_hash": state["p_password_hash"],
            }])
        return httpx.Response(200, json=[{"ma_kh": state["p_customer_id"], "ten_kh": "Customer Name"}])

    with httpx.Client(transport=httpx.MockTransport(handle)) as transport:
        db = SyncPostgrestClient("https://auth.test/rest/v1", http_client=transport)
        app = FastAPI()
        app.include_router(auth_router)
        app.dependency_overrides[get_supabase] = lambda: db
        with TestClient(app) as client:
            response = client.post("/api/auth/register", json={
                "name": "  Customer Name  ", "username": " customer ",
                "email": " CUSTOMER@EXAMPLE.COM ", "phone": " 0901234567 ",
                "password": "customer-password",
            }, headers={"Origin": "http://localhost:3001"})
            assert response.status_code == 201
            assert response.json() == {
                "account_id": "KH000001", "username": "customer", "role": "KHACH_HANG",
                "name": "Customer Name", "customer_id": state["p_customer_id"],
                "employee_id": None, "warehouse_id": None,
            }
            assert "HttpOnly" in response.headers["set-cookie"]
            assert "customer-password" not in response.text and "p_password_hash" not in response.text
            assert client.get("/api/auth/me").status_code == 200
    registration_attempts.clear()


def test_customer_registration_returns_safe_conflict_and_rejects_extra_fields(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "test-only-" + "x" * 64)
    registration_attempts.clear()
    calls = 0

    def handle(request):
        nonlocal calls
        calls += 1
        return httpx.Response(409, json={"code": "23505", "message": "PRIVATE", "details": None, "hint": None})

    with httpx.Client(transport=httpx.MockTransport(handle)) as transport:
        db = SyncPostgrestClient("https://auth.test/rest/v1", http_client=transport)
        app = FastAPI()
        app.include_router(auth_router)
        app.dependency_overrides[get_supabase] = lambda: db
        with TestClient(app) as client:
            payload = {
                "name": "Customer Name", "username": "customer", "email": "customer@example.com",
                "password": "customer-password",
            }
            response = client.post("/api/auth/register", json=payload, headers={"Origin": "http://localhost:3001"})
            assert response.status_code == 409
            assert response.json() == {"detail": "Tên tài khoản hoặc email đã được sử dụng."}
            assert "PRIVATE" not in response.text
            invalid = client.post("/api/auth/register", json=payload | {"role": "ADMIN"}, headers={"Origin": "http://localhost:3001"})
            assert invalid.status_code == 422
            assert calls == 1
    registration_attempts.clear()
