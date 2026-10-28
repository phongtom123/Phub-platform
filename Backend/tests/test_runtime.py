import pytest
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient

from phub_api.controllers.health import router
from phub_api.config.runtime import frontend_origins


def test_default_origins_cover_all_local_portal_hosts(monkeypatch):
    monkeypatch.delenv("FRONTEND_URL", raising=False)
    monkeypatch.delenv("FRONTEND_ORIGINS", raising=False)
    assert frontend_origins() == [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002",
        "http://127.0.0.1:8000",
    ]


def test_explicit_origins_override_legacy_setting_and_deduplicate(monkeypatch):
    monkeypatch.setenv("FRONTEND_URL", "https://old.example")
    monkeypatch.setenv("FRONTEND_ORIGINS", " https://shop.onrender.com/ ,http://127.0.0.1:3001,https://shop.onrender.com")
    assert frontend_origins() == ["https://shop.onrender.com", "http://127.0.0.1:3001"]


@pytest.mark.parametrize("value", ["", "*", "https://*.example.com", "ftp://example.com", "shop.onrender.com", "https://name:secret@example.com", "https://example.com/path", "https://example.com?x=1", "https://example.com#part", "https://example.com:wrong", "https://exam ple.com", "https://"])
def test_invalid_origins_fail_before_serving_requests(monkeypatch, value):
    monkeypatch.setenv("FRONTEND_ORIGINS", value)
    with pytest.raises(RuntimeError, match="FRONTEND_ORIGINS"):
        frontend_origins()


def test_render_origin_and_credentials_are_allowed_without_opening_other_origins(monkeypatch):
    monkeypatch.setenv("FRONTEND_ORIGINS", "https://shop.onrender.com")
    app = FastAPI()
    app.include_router(router)
    app.add_middleware(CORSMiddleware, allow_origins=frontend_origins(), allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
    with TestClient(app) as client:
        allowed = client.options("/api/health", headers={"Origin": "https://shop.onrender.com", "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "Authorization"})
        assert allowed.status_code == 200
        assert allowed.headers["access-control-allow-origin"] == "https://shop.onrender.com"
        assert allowed.headers["access-control-allow-credentials"] == "true"
        denied = client.options("/api/health", headers={"Origin": "https://another.example", "Access-Control-Request-Method": "GET"})
        assert denied.status_code == 400
        assert "access-control-allow-origin" not in denied.headers
        live = client.get("/api/health")
        assert live.json() == {"status": "ok"}
        assert live.headers["cache-control"] == "no-store"
        assert client.get("/openapi.json").json()["paths"]["/api/health"]["get"]["tags"] == ["Health"]
