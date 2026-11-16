import json

import httpx
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from postgrest import SyncPostgrestClient

from phub_api.models.user import User
from phub_api.dependencies.auth import current_user, require_admin, require_customer_user, require_warehouse
from phub_api.services.auth import login_attempts, registration_attempts
from phub_api.controllers.auth import router as auth_router
from phub_api.models.customer import CurrentCustomer
from phub_api.dependencies.customer import require_customer
from phub_api.config.database import get_supabase


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
        "TK2", "warehouse", "NHAN_VIEN", "Warehouse",
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


def test_staff_read_guard_does_not_require_an_assigned_warehouse():
    client = build_client(User(
        "TK2", "warehouse", "NHAN_VIEN", "Warehouse", employee_id="NV2",
    ))
    assert client.get("/warehouse").status_code == 200


@pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer forged"}, {"Authorization": "Basic invalid"}])
def test_missing_or_malformed_session_is_rejected_before_database_config(monkeypatch, headers):
    monkeypatch.delenv("JWT_SECRET", raising=False)
    database_calls = []

    def unavailable_database():
        database_calls.append(True)
        raise RuntimeError("Database configuration is unavailable")

    app = FastAPI()
    app.include_router(auth_router)
    app.dependency_overrides[get_supabase] = unavailable_database
    with TestClient(app) as client:
        assert client.get("/api/auth/me", headers=headers).status_code == 401
    assert database_calls == []


@pytest.mark.parametrize("endpoint", ["login", "token"])
def test_customer_auth_flows_through_the_shared_dependency(monkeypatch, endpoint):
    monkeypatch.setenv("JWT_SECRET", "test-only-" + "x" * 64)
    login_attempts.clear()
    account = {
        "ma_tk": "TK3", "ten_tai_khoan": "customer", "ma_kh": "KH3",
        "ma_nhan_vien": None, "trang_thai": 1,
        "mat_khau": "customer-password",
        "phien_ban_mat_khau": "00000000-0000-4000-8000-000000000001",
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
                "/api/auth/" + endpoint,
                json={"username": "customer", "password": "customer-password"},
                headers={"Origin": "http://127.0.0.1:3001"},
            )
            assert login.status_code == 200
            headers = {}
            if endpoint == "login":
                assert login.json()["role"] == "KHACH_HANG"
                assert "HttpOnly" in login.headers["set-cookie"]
            else:
                assert "set-cookie" not in login.headers
                headers = {"Authorization": "Bearer " + login.json()["access_token"]}
            assert client.get("/customer", headers=headers).json() == {"customer_id": "KH3"}


@pytest.mark.parametrize(("linked_from_db", "linked_orders"), [(None, 0), (2, 2), ("3", 0), (-1, 0), (True, 0)])
def test_customer_registration_is_atomic_and_starts_a_session(monkeypatch, linked_from_db, linked_orders):
    monkeypatch.setenv("JWT_SECRET", "test-only-" + "x" * 64)
    registration_attempts.clear()
    state = {}

    def handle(request):
        if request.url.path.endswith("/rpc/customer_register_v2"):
            payload = json.loads(request.content)
            state.update(payload)
            assert payload["p_customer_id"].startswith("KH_")
            assert payload["p_email"] == "customer@example.com"
            assert payload["p_name"] == "Customer Name"
            assert payload["p_phone"] == "0901234567"
            assert ("customer-password" == payload["p_password"])
            result = {
                "account_id": "KH000001", "username": "customer", "role": "KHACH_HANG",
                "name": "Customer Name", "customer_id": payload["p_customer_id"],
                "employee_id": None, "warehouse_id": None,
                "credential_version": "00000000-0000-4000-8000-000000000001",
            }
            if linked_from_db is not None:
                result["linked_orders"] = linked_from_db
            return httpx.Response(200, json=result)
        if request.url.path.endswith("/TAI_KHOAN"):
            return httpx.Response(200, json=[{
                "ma_tk": "KH000001", "ten_tai_khoan": "customer",
                "ma_kh": state["p_customer_id"], "ma_nhan_vien": None, "trang_thai": 1,
                "mat_khau": state["p_password"],
                "phien_ban_mat_khau": "00000000-0000-4000-8000-000000000001",
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
            }, headers={"Origin": "http://127.0.0.1:3001"})
            assert response.status_code == 201
            assert response.json() == {
                "account_id": "KH000001", "username": "customer", "role": "KHACH_HANG",
                "name": "Customer Name", "customer_id": state["p_customer_id"],
                "employee_id": None, "warehouse_id": None, "linked_orders": linked_orders,
            }
            assert "HttpOnly" in response.headers["set-cookie"]
            assert "customer-password" not in response.text and "p_password" not in response.text
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


@pytest.mark.parametrize(("message", "details", "expected"), [
    ('duplicate key value violates unique constraint "TAI_KHOAN_ten_tai_khoan_key"',
     "Key (ten_tai_khoan)=(customer) already exists.", "Tên tài khoản đã được sử dụng. Vui lòng chọn tên khác."),
    ('duplicate key value violates unique constraint "TAI_KHOAN_email_key"',
     "Key (email)=(customer@example.com) already exists.",
     "Email đã được đăng ký. Hãy đăng nhập, hoặc liên hệ cửa hàng nếu tài khoản bị khóa."),
    ('duplicate key value violates unique constraint "TAI_KHOAN_email_key"', None,
     "Email đã được đăng ký. Hãy đăng nhập, hoặc liên hệ cửa hàng nếu tài khoản bị khóa."),
])
def test_customer_registration_names_the_duplicate_field_without_echoing_data(monkeypatch, message, details, expected):
    monkeypatch.setenv("JWT_SECRET", "test-only-" + "x" * 64)
    registration_attempts.clear()

    def handle(request):
        return httpx.Response(409, json={"code": "23505", "message": message, "details": details, "hint": None})

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
            assert response.json() == {"detail": expected}
            assert "TAI_KHOAN" not in response.text and "already exists" not in response.text
    registration_attempts.clear()


def embedded_account(**overrides):
    account = {
        "ma_tk": "TK2", "ten_tai_khoan": "warehouse", "ma_kh": None, "ma_nhan_vien": "NV2",
        "trang_thai": 1, "mat_khau": "warehouse-password", "luu_tru_luc": None,
        "phien_ban_mat_khau": "00000000-0000-4000-8000-000000000002",
        "employee": {"ma_nhan_vien": "NV2", "ho_ten": "Thủ kho", "loai_nhan_vien": "NHAN_VIEN", "ma_kho": 2, "trang_thai": 1},
        "customer": None,
    }
    account.update(overrides)
    return account


def auth_repository(handle):
    from phub_api.repositories.auth import AuthRepository
    transport = httpx.Client(transport=httpx.MockTransport(handle))
    return AuthRepository(SyncPostgrestClient("https://auth.test/rest/v1", http_client=transport))


def test_authenticated_identity_uses_one_query_with_embedded_profile():
    from phub_api.services.auth import identity
    paths = []

    def handle(request):
        paths.append((request.url.path, request.url.params.get("select")))
        return httpx.Response(200, json=[embedded_account()])

    repository = auth_repository(handle)
    user = identity(repository.account("TK2")[0], repository)
    assert (user.role, user.employee_id, user.warehouse_id, user.name) == ("NHAN_VIEN", "NV2", 2, "Thủ kho")
    assert len(paths) == 1 and paths[0][0].endswith("/TAI_KHOAN")
    assert "employee:NHAN_VIEN!ma_nhan_vien(" in paths[0][1] and "customer:KHACH_HANG!ma_kh(" in paths[0][1]


@pytest.mark.parametrize(("overrides", "message"), [
    ({"employee": None}, "Nhân viên không hoạt động."),
    ({"employee": {"ma_nhan_vien": "NV2", "ho_ten": "X", "loai_nhan_vien": "NHAN_VIEN", "ma_kho": 2, "trang_thai": 0}}, "Nhân viên không hoạt động."),
    ({"employee": {"ma_nhan_vien": "NV2", "ho_ten": "X", "loai_nhan_vien": "NHAN_VIEN", "ma_kho": None, "trang_thai": 1}}, "Chưa được phân quyền hoặc phân kho."),
    ({"ma_nhan_vien": None, "ma_kh": "KH3", "employee": None, "customer": None}, "Không tìm thấy khách hàng."),
    ({"ma_nhan_vien": None, "ma_kh": "KH3", "employee": None,
      "customer": {"ma_kh": "KH3", "ten_kh": "C", "luu_tru_luc": "2026-11-01T00:00:00Z"}}, "Tài khoản khách hàng đã bị xóa."),
])
def test_embedded_profile_keeps_existing_rejections_without_extra_queries(overrides, message):
    from fastapi import HTTPException
    from phub_api.services.auth import identity
    paths = []

    def handle(request):
        paths.append(request.url.path)
        return httpx.Response(200, json=[embedded_account(**overrides)])

    repository = auth_repository(handle)
    with pytest.raises(HTTPException) as error:
        identity(repository.account("TK2")[0], repository)
    assert error.value.status_code == 403 and message in error.value.detail
    assert len(paths) == 1


def test_account_lookup_falls_back_when_relationship_embed_is_unavailable():
    from phub_api.services.auth import identity
    paths = []
    plain = {key: value for key, value in embedded_account().items() if key not in {"employee", "customer"}}

    def handle(request):
        paths.append(request.url.path)
        if request.url.path.endswith("/TAI_KHOAN"):
            if "employee:" in (request.url.params.get("select") or ""):
                return httpx.Response(400, json={"code": "PGRST200", "message": "Could not find a relationship", "details": None, "hint": None})
            return httpx.Response(200, json=[plain])
        return httpx.Response(200, json=[embedded_account()["employee"]])

    repository = auth_repository(handle)
    user = identity(repository.account("TK2")[0], repository)
    assert user.warehouse_id == 2
    assert [path.rsplit("/", 1)[1] for path in paths] == ["TAI_KHOAN", "TAI_KHOAN", "NHAN_VIEN"]
