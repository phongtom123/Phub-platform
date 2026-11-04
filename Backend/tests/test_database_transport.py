import logging

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from postgrest import SyncPostgrestClient

from phub_api.config.database_transport import DatabaseTransport, READ_FAILURES
from phub_api.middleware.errors import register_errors


@pytest.fixture(autouse=True)
def no_sleep(monkeypatch):
    monkeypatch.setattr("phub_api.config.database_transport.time.sleep", lambda _: None)
    monkeypatch.setattr("phub_api.config.database_transport.random.uniform", lambda *_: 0)


@pytest.mark.parametrize("error", READ_FAILURES)
@pytest.mark.parametrize("method", ["GET", "HEAD"])
def test_reads_recover_from_one_transient_failure(error, method):
    calls = []

    def handle(request):
        calls.append(request)
        if len(calls) == 1:
            raise error("private upstream details", request=request)
        return httpx.Response(200, json={"ok": True})

    with httpx.Client(transport=DatabaseTransport(httpx.MockTransport(handle))) as client:
        assert client.request(method, "https://db.test/rest/v1/TAI_KHOAN").status_code == 200
    assert len(calls) == 2


@pytest.mark.parametrize("status", [502, 503, 504])
def test_reads_recover_from_transient_status(status):
    calls = []

    def handle(request):
        calls.append(request)
        return httpx.Response(status if len(calls) == 1 else 200, json=[])

    with httpx.Client(transport=DatabaseTransport(httpx.MockTransport(handle))) as client:
        assert client.get("https://db.test/rest/v1/SAN_PHAM").status_code == 200
    assert len(calls) == 2


@pytest.mark.parametrize("method", ["POST", "PATCH", "PUT", "DELETE"])
@pytest.mark.parametrize("failure", ["network", "status"])
def test_writes_and_transaction_rpcs_are_never_replayed(method, failure):
    calls = []

    def handle(request):
        calls.append(request)
        if failure == "network":
            raise httpx.ReadTimeout("write may have committed", request=request)
        return httpx.Response(503, json={"code": "unavailable"})

    with httpx.Client(transport=DatabaseTransport(httpx.MockTransport(handle))) as client:
        if failure == "network":
            with pytest.raises(httpx.ReadTimeout):
                client.request(method, "https://db.test/rest/v1/rpc/admin_create_account_v1", json={"password": "secret"})
        else:
            assert client.request(method, "https://db.test/rest/v1/rpc/admin_create_account_v1").status_code == 503
    assert len(calls) == 1


@pytest.mark.parametrize("status", [400, 401, 403, 404, 409, 422, 429, 500])
def test_nontransient_statuses_are_not_retried(status):
    calls = []
    with httpx.Client(transport=DatabaseTransport(httpx.MockTransport(
        lambda request: calls.append(request) or httpx.Response(status, json=[])
    ))) as client:
        assert client.get("https://db.test/rest/v1/SAN_PHAM").status_code == status
    assert len(calls) == 1


def test_pool_exhaustion_is_not_amplified_with_retries():
    calls = []

    def handle(request):
        calls.append(request)
        raise httpx.PoolTimeout("pool exhausted", request=request)

    with httpx.Client(transport=DatabaseTransport(httpx.MockTransport(handle))) as client:
        with pytest.raises(httpx.PoolTimeout):
            client.get("https://db.test/rest/v1/SAN_PHAM")
    assert len(calls) == 1


def test_attempts_are_bounded_and_logs_never_include_credentials(caplog):
    calls = []

    def handle(request):
        calls.append(request)
        raise httpx.ConnectError("secret-key private-error", request=request)

    with caplog.at_level(logging.WARNING), httpx.Client(transport=DatabaseTransport(httpx.MockTransport(handle))) as client:
        with pytest.raises(httpx.ConnectError):
            client.get("https://db.test/rest/v1/TAI_KHOAN?email=eq.private-email", headers={"apikey": "secret-key", "Cookie": "private-cookie"})
    assert len(calls) == 3
    assert "ConnectError" in caplog.text
    assert not any(secret in caplog.text for secret in ["secret-key", "private-error", "private-email", "private-cookie"])


def test_budget_stops_retries_and_preserves_error_type(monkeypatch):
    clock = [0.0]
    calls = []
    monkeypatch.setattr("phub_api.config.database_transport.time.monotonic", lambda: clock[0])

    def handle(request):
        calls.append(request)
        clock[0] = 0.9
        raise httpx.RemoteProtocolError("connection closed", request=request)

    with httpx.Client(transport=DatabaseTransport(httpx.MockTransport(handle), budget=1)) as client:
        with pytest.raises(httpx.RemoteProtocolError):
            client.get("https://db.test/rest/v1/SAN_PHAM")
    assert len(calls) == 1


def test_deadline_clamps_operation_timeouts_and_restores_request_extensions():
    seen = []
    transport = DatabaseTransport(httpx.MockTransport(lambda request: seen.append(dict(request.extensions["timeout"])) or httpx.Response(200)), budget=2)
    with httpx.Client(transport=transport, timeout=30) as client:
        request = client.build_request("GET", "https://db.test/rest/v1/SAN_PHAM")
        previous = dict(request.extensions["timeout"])
        client.send(request)
    assert all(0 < value <= 2 for value in seen[0].values())
    assert request.extensions["timeout"] == previous


def test_persistent_503_returns_last_response_after_three_attempts():
    calls = []
    with httpx.Client(transport=DatabaseTransport(httpx.MockTransport(
        lambda request: calls.append(request) or httpx.Response(503, json={"code": "unavailable"})
    ))) as client:
        response = client.get("https://db.test/rest/v1/SAN_PHAM")
        assert response.status_code == 503 and response.json() == {"code": "unavailable"}
    assert len(calls) == 3


def test_broken_response_body_is_retried_and_closed():
    calls, closed = [], []

    class BrokenBody(httpx.SyncByteStream):
        def __iter__(self):
            yield b"["
            raise httpx.ReadError("body interrupted")

        def close(self):
            closed.append(True)

    def handle(request):
        calls.append(request)
        return httpx.Response(200, stream=BrokenBody()) if len(calls) == 1 else httpx.Response(200, json=[])

    with httpx.Client(transport=DatabaseTransport(httpx.MockTransport(handle))) as client:
        assert client.get("https://db.test/rest/v1/SAN_PHAM").json() == []
    assert len(calls) == 2 and closed


def test_get_with_body_is_not_replayed():
    calls = []
    with httpx.Client(transport=DatabaseTransport(httpx.MockTransport(
        lambda request: calls.append(request) or httpx.Response(503)
    ))) as client:
        assert client.request("GET", "https://db.test/rest/v1/rpc/function", content=b"payload").status_code == 503
    assert len(calls) == 1


def test_real_postgrest_read_recovers_and_keeps_auth_headers():
    calls = []

    def handle(request):
        calls.append(request)
        assert request.headers["apikey"] == "test-only-key"
        if len(calls) == 1:
            raise httpx.ConnectError("temporarily disconnected", request=request)
        return httpx.Response(200, json=[{"ma_sp": "SP-TEST"}])

    with httpx.Client(transport=DatabaseTransport(httpx.MockTransport(handle))) as client:
        db = SyncPostgrestClient("https://db.test/rest/v1", headers={"apikey": "test-only-key"}, http_client=client)
        assert db.table("SAN_PHAM").select("ma_sp").execute().data == [{"ma_sp": "SP-TEST"}]
    assert len(calls) == 2


def test_final_connection_error_is_safe_diagnostic_503(caplog):
    app = FastAPI()
    register_errors(app)

    @app.get("/api/test/{record_id}")
    def fail(record_id: str):
        raise httpx.ConnectError("never-log-secret-or-query")

    with caplog.at_level(logging.WARNING), TestClient(app) as client:
        response = client.get("/api/test/private-record?email=private-email")
    assert response.status_code == 503
    assert response.json() == {"detail": "Không kết nối được Supabase."}
    assert response.headers["retry-after"] == "1"
    assert response.headers["cache-control"] == "no-store"
    assert "ConnectError" in caplog.text and "/api/test/{record_id}" in caplog.text
    assert not any(secret in caplog.text for secret in ["never-log-secret", "private-record", "private-email"])


def test_supabase_factory_uses_shared_pool_and_shuts_down(monkeypatch):
    from phub_api.config import database as module

    module.close_supabase()
    monkeypatch.setenv("SUPABASE_URL", "https://db.test")
    monkeypatch.setenv("SUPABASE_SECRET_KEY", "test-only-key")
    try:
        db = module.get_supabase()
        assert db is module.get_supabase()
        client = module.get_http_client()
        assert db.options.httpx_client is client
        assert db.postgrest.session is client
        assert isinstance(client._transport, DatabaseTransport)
        assert client.timeout.connect == 2 and client.timeout.read == 4
    finally:
        module.close_supabase()
    assert client.is_closed
    assert module.get_supabase.cache_info().currsize == 0


def test_health_and_docs_do_not_open_database_with_missing_credentials(monkeypatch):
    from phub_api.main import app
    from phub_api.config import database as module

    module.close_supabase()
    monkeypatch.delenv("SUPABASE_SECRET_KEY", raising=False)
    with TestClient(app) as client:
        assert client.get("/api/health").status_code == 200
        assert client.get("/docs").status_code == 200
        assert module.get_http_client.cache_info().currsize == 0
        assert client.get("/api/products").status_code == 503
        assert module.get_http_client.cache_info().currsize == 0
