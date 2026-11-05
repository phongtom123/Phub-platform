import hashlib
import json

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from postgrest import SyncPostgrestClient

from phub_api.config.database import get_supabase
from phub_api.controllers.auth import router
from phub_api.services.auth import login_attempts

SOURCE = "https://admin.example.test"
TARGET = "https://warehouse.example.test"
PASSWORD = "fixture-password"


@pytest.fixture
def portals(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "fixture-secret-" + "x" * 48)
    monkeypatch.setenv("FRONTEND_ORIGINS", SOURCE + "," + TARGET)
    monkeypatch.setenv("COOKIE_SECURE", "true")
    login_attempts.clear()
    state = {"now": 0, "codes": {}, "role": "NHAN_VIEN", "active": 1, "version": "revision-1", "calls": []}

    def handle(request):
        path = request.url.path
        if path.endswith("/TAI_KHOAN"):
            return httpx.Response(200, json=[{"ma_tk": "STAFF1", "ten_tai_khoan": "staff",
                "ma_nhan_vien": "NV1", "ma_kh": None, "trang_thai": state["active"],
                "mat_khau": PASSWORD, "phien_ban_mat_khau": state["version"]}])
        if path.endswith("/NHAN_VIEN"):
            return httpx.Response(200, json=[{"ma_nhan_vien": "NV1", "ho_ten": "Staff", "trang_thai": 1,
                "loai_nhan_vien": state["role"], "ma_kho": 1 if state["role"] == "NHAN_VIEN" else None}])
        parameters = json.loads(request.content)
        state["calls"].append((path, parameters))
        if path.endswith("/rpc/auth_create_portal_handoff_v1"):
            state["codes"][parameters["p_code_hash"]] = parameters | {"expires": state["now"] + 60}
            return httpx.Response(200, json=True)
        if path.endswith("/rpc/auth_consume_portal_handoff_v1"):
            stored = state["codes"].get(parameters["p_code_hash"])
            if stored and stored["expires"] > state["now"] and all(
                stored[key] == parameters[key] for key in ["p_source_origin", "p_target_origin", "p_role"]
            ):
                del state["codes"][parameters["p_code_hash"]]
                return httpx.Response(200, json={"account_id": stored["p_account_id"], "credential_version": stored["p_credential_version"]})
            return httpx.Response(200, json=None)
        raise AssertionError("Unexpected endpoint")

    app = FastAPI()
    app.include_router(router)
    with httpx.Client(transport=httpx.MockTransport(handle)) as transport:
        db = SyncPostgrestClient("https://offline.test/rest/v1", http_client=transport)
        app.dependency_overrides[get_supabase] = lambda: db
        with TestClient(app, base_url=SOURCE) as source, TestClient(app, base_url=TARGET) as target:
            yield source, target, state


def issue(source, target_origin=TARGET):
    login = source.post("/api/auth/login", json={"username": "staff", "password": PASSWORD}, headers={"Origin": SOURCE})
    assert login.status_code == 200
    response = source.post("/api/auth/handoff", json={"target_origin": target_origin}, headers={"Origin": SOURCE})
    return response


def exchange(target, code, source_origin=SOURCE, target_origin=TARGET, role="NHAN_VIEN"):
    return target.post("/api/auth/handoff/exchange", json={"code": code, "target_origin": target_origin, "role": role}, headers={"Origin": source_origin})


def test_two_hosts_get_separate_cookie_sessions_without_sharing_passwords(portals):
    source, target, state = portals
    created = issue(source)
    assert created.status_code == 200
    code = created.json()["code"]
    assert created.json()["expires_in"] == 60 and len(code) == 43
    stored = next(iter(state["codes"].values()))
    assert stored["p_code_hash"] == hashlib.sha256(code.encode()).hexdigest()
    assert code not in json.dumps(stored) and PASSWORD not in json.dumps(stored)
    assert target.get("/api/auth/me").status_code == 401
    response = exchange(target, code)
    assert response.status_code == 200 and response.json()["role"] == "NHAN_VIEN"
    assert "access_token" not in response.json()
    cookie = response.headers["set-cookie"].lower()
    assert "httponly" in cookie and "secure" in cookie and "domain=" not in cookie
    assert target.get("/api/auth/me").status_code == 200
    assert source.get("/api/auth/me").status_code == 200
    replay = exchange(target, code)
    assert replay.status_code == 401 and "set-cookie" not in replay.headers


@pytest.mark.parametrize("change", ["expired", "password", "inactive", "role"])
def test_expired_or_revoked_handoffs_never_set_a_cookie(portals, change):
    source, target, state = portals
    code = issue(source).json()["code"]
    if change == "expired": state["now"] = 61
    if change == "password": state["version"] = "revision-2"
    if change == "inactive": state["active"] = 0
    if change == "role": state["role"] = "ADMIN"
    response = exchange(target, code)
    assert response.status_code in {401, 403}
    assert "set-cookie" not in response.headers


def test_codes_are_bound_to_source_destination_and_role(portals):
    source, target, _ = portals
    code = issue(source).json()["code"]
    for arguments in [{"source_origin": TARGET}, {"target_origin": SOURCE}, {"role": "ADMIN"}]:
        response = exchange(target, code, **arguments)
        assert response.status_code == 401 and "set-cookie" not in response.headers
    assert exchange(target, code).status_code == 200


def test_untrusted_origins_and_unauthenticated_issuance_are_rejected(portals):
    source, target, state = portals
    assert target.post("/api/auth/handoff", json={"target_origin": TARGET}, headers={"Origin": TARGET}).status_code == 401
    assert issue(source, "https://attacker.invalid").status_code == 403
    code = issue(source).json()["code"]
    before = len(state["calls"])
    response = exchange(target, code, source_origin="https://attacker.invalid")
    assert response.status_code == 403 and len(state["calls"]) == before


def test_admin_role_is_preserved_and_never_becomes_warehouse(portals):
    source, target, state = portals
    state["role"] = "ADMIN"
    code = issue(source).json()["code"]
    assert exchange(target, code).status_code == 401
    assert exchange(target, code, role="ADMIN").json()["role"] == "ADMIN"
