import json
from copy import deepcopy

import httpx
import pytest
from fastapi.testclient import TestClient
from postgrest import SyncPostgrestClient

from phub_api.config.database import get_supabase
from phub_api.dependencies.auth import current_user
from phub_api.main import app
from phub_api.models.resources import public_columns, schema
from phub_api.models.user import User
from phub_api.schemas.resources import payload_model

ADMIN = User("AD1", "admin", "ADMIN", "Admin", employee_id="NV1")
PROFILE = {"ma_kh": "KH1", "ten_kh": "Khách cũ", "sdt": "0901234567",
           "dia_chi_chi_tiet_md": None, "tinh_thanh_md": None, "xa_phuong_md": None,
           "ngay_sinh": None, "ngay_tao": None, "cap_nhat_luc": None, "luu_tru_luc": None}
ACCOUNT = {"ma_tk": "TK1", "ten_tai_khoan": "customer", "email": "customer@example.test", "trang_thai": 1}
PATH = "/api/crm/customers/KH1"
ORIGIN = {"Origin": "http://localhost:3000"}


@pytest.fixture
def crm_client(monkeypatch):
    monkeypatch.setenv("FRONTEND_ORIGINS", "http://localhost:3000")
    state = {"actor": ADMIN, "profile": deepcopy(PROFILE), "account": deepcopy(ACCOUNT),
             "rpc_error": None, "rpc_calls": [], "requests": [], "orders": [], "total": 0}

    def handle(request):
        state["requests"].append(request)
        table = request.url.path.split("/")[-1]
        if table == "admin_update_customer_profile_v2":
            values = json.loads(request.content)
            state["rpc_calls"].append(values)
            if state["rpc_error"]:
                return httpx.Response(400, json={"code": state["rpc_error"], "message": "private SQL", "details": None, "hint": None})
            state["profile"].update(values["p_changes"])
            assert set(values) == {"p_customer_id", "p_actor_account_id", "p_changes"}
            return httpx.Response(200, json={"profile": state["profile"], "account": state["account"]})
        assert request.method == "GET", "CRM writes must be one RPC, not separate table writes"
        assert table not in {"SO_THICH", "KHACH_HANG_SO_THICH"}
        assert request.url.params["ma_kh"] in {"eq.KH1", "eq.MISSING"}
        if table == "KHACH_HANG":
            rows = [state["profile"]] if state["profile"] and request.url.params["ma_kh"] == "eq.KH1" else []
        elif table == "TAI_KHOAN":
            assert "mat_khau_hash" not in request.url.params["select"]
            rows = [state["account"]] if state["account"] else []
        else:
            assert table == "DON_HANG"
            return httpx.Response(200, json=state["orders"], headers={"Content-Range": f"0-0/{state['total']}"})
        return httpx.Response(200, json=rows)

    with httpx.Client(transport=httpx.MockTransport(handle)) as transport:
        db = SyncPostgrestClient("https://crm.test/rest/v1", http_client=transport)
        app.dependency_overrides[current_user] = lambda: state["actor"]
        app.dependency_overrides[get_supabase] = lambda: db
        try:
            with TestClient(app) as client:
                yield client, state
        finally:
            app.dependency_overrides.clear()


def test_profile_old_nulls_and_safe_account(crm_client):
    client, state = crm_client
    response = client.get(PATH)
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.json()["profile"] == PROFILE
    assert response.json()["account"] == ACCOUNT
    assert set(response.json()) == {"profile", "account"}
    assert len(state["requests"]) == 2  # No reads of the removed interest tables.
    assert "mat_khau" not in response.text
    state["account"] = None
    assert client.get(PATH).json()["account"] is None


@pytest.mark.parametrize("actor", [User("K", "k", "KHACH_HANG", "Khách", customer_id="KH1"),
                                    User("W", "w", "THU_KHO", "Kho", warehouse_id=1)])
@pytest.mark.parametrize("method,suffix,body", [("GET", "", None), ("GET", "/orders", None),
                                                ("PATCH", "", {"ngay_sinh": "2000-01-01"})])
def test_non_admin_denied_before_database(crm_client, actor, method, suffix, body):
    client, state = crm_client
    state["actor"] = actor
    assert client.request(method, PATH + suffix, json=body, headers=ORIGIN).status_code == 403
    assert not state["requests"]


def test_unknown_customer(crm_client):
    client, _ = crm_client
    assert client.get("/api/crm/customers/MISSING").status_code == 404


def test_patch_uses_one_rpc_and_committed_snapshot(crm_client):
    client, state = crm_client
    response = client.patch(PATH, headers=ORIGIN, json={"ten_kh": "  Tên mới  ", "ngay_sinh": "2000-02-29"})
    assert response.status_code == 200
    assert response.json()["profile"]["ten_kh"] == "Tên mới"
    assert set(response.json()) == {"profile", "account"}
    assert len(state["requests"]) == 1
    assert state["rpc_calls"] == [{"p_customer_id": "KH1", "p_actor_account_id": "AD1",
                                   "p_changes": {"ten_kh": "Tên mới", "ngay_sinh": "2000-02-29"}}]


def test_clear_birthday(crm_client):
    client, state = crm_client
    response = client.patch(PATH, headers=ORIGIN, json={"ngay_sinh": None})
    assert response.status_code == 200
    assert state["rpc_calls"][0]["p_changes"] == {"ngay_sinh": None}


def test_omitted_profile_fields_are_preserved(crm_client):
    client, state = crm_client
    response = client.patch(PATH, headers=ORIGIN, json={"sdt": None})
    assert response.status_code == 200
    assert response.json()["profile"]["ten_kh"] == PROFILE["ten_kh"]
    assert state["rpc_calls"][0]["p_changes"] == {"sdt": None}


@pytest.mark.parametrize("body", [{}, {"ma_kh": "KH2"}, {"ngay_tao": "2026-01-01"}, {"luu_tru_luc": None},
                                  {"trang_thai": 2}, {"email": "x@test.com"}, {"ten_kh": None}, {"ten_kh": "   "},
                                  {"ngay_sinh": "2999-01-01"}, {"ngay_sinh": "2001-02-29"}, {"ngay_sinh": 1000},
                                  {"so_thich": None}, {"so_thich": []}, {"so_thich": ["GAMING"]}])
def test_invalid_or_readonly_patch_denied(crm_client, body):
    client, state = crm_client
    assert client.patch(PATH, headers=ORIGIN, json=body).status_code == 422
    assert not state["rpc_calls"]


def test_csrf_denied(crm_client):
    client, state = crm_client
    assert client.patch(PATH, json={"sdt": None}, headers={"Origin": "https://evil.test"}).status_code == 403
    assert not state["requests"]


@pytest.mark.parametrize("code,status", [("PGRST202", 503), ("P0002", 404), ("42501", 403), ("23514", 422)])
def test_rpc_errors_are_sanitized(crm_client, code, status):
    client, state = crm_client
    state["rpc_error"] = code
    response = client.patch(PATH, headers=ORIGIN, json={"ten_kh": "Khách mới"})
    assert response.status_code == status
    assert "private SQL" not in response.text
    if status == 503:
        assert "20261023012955_remove_customer_interests.sql" in response.json()["detail"]


def test_orders_scoped_paginated_and_stable(crm_client):
    client, state = crm_client
    state["orders"] = [{"ma_donhang": "DH1", "trang_thai": "HOAN_THANH", "kenh_ban": "ONLINE", "thoi_gian_dat": "2026-10-01T09:00:00"}]
    state["total"] = 21
    response = client.get(PATH + "/orders?page=2&page_size=10")
    assert response.status_code == 200
    assert response.json()["total"] == 21
    params = state["requests"][-1].url.params
    assert params["ma_kh"] == "eq.KH1"
    assert params["offset"] == "10" and params["limit"] == "10"
    assert "thoi_gian_dat.desc" in params["order"]
    assert client.get(PATH + "/orders?page_size=101").status_code == 422


def test_dbml_dates_and_system_fields():
    assert "SO_THICH" not in schema() and "KHACH_HANG_SO_THICH" not in schema()
    columns = {c["name"]: c["type"] for c in public_columns("customers")}
    assert columns["ngay_sinh"] == "date" and columns["cap_nhat_luc"] == "timestamptz"
    model = payload_model("customers", True)
    assert not {"ngay_tao", "cap_nhat_luc", "luu_tru_luc"}.intersection(model.model_fields)
    assert model.model_validate({"ngay_sinh": "2000-01-01"}).model_dump(mode="json")["ngay_sinh"] == "2000-01-01"


def test_generic_api_rejects_future_birthday(crm_client):
    client, state = crm_client
    response = client.patch('/api/data/customers?key=["KH1"]', headers=ORIGIN, json={"ngay_sinh": "2999-01-01"})
    assert response.status_code == 422
    assert not state["rpc_calls"]
