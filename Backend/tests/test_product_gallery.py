from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from postgrest.exceptions import APIError

from phub_api.controllers.media import router
from phub_api.dependencies.auth import current_user
from phub_api.dependencies.media import get_service
from phub_api.models.user import User
from phub_api.schemas.media import GalleryUpdate
from phub_api.services.media import MediaService

ORIGIN = {"Origin": "http://localhost:3000"}
ID = "00000000-0000-0000-0000-000000000001"


@pytest.fixture
def gallery_client(monkeypatch):
    monkeypatch.setenv("FRONTEND_ORIGINS", "http://localhost:3000")
    state = {"role": "ADMIN", "calls": [], "rows": [{"ma_sp": "SP1", "duong_dan_anh": "/images/old.png", "images": [
        {"ma_media": ID, "url": "/images/old.png", "alt_text": None, "thu_tu": 0, "la_anh_chinh": True},
    ]}], "error": None}

    def save(product_id, values):
        state["calls"].append((product_id, values))
        if state["error"]:
            raise APIError({"code": state["error"], "message": "internal SQL error", "details": None, "hint": None})
        return {"product_id": product_id, "legacy_url": None, "images": []}

    service = MediaService(SimpleNamespace(product_gallery=lambda _: state["rows"], save_gallery=save))
    app = FastAPI(); app.include_router(router)

    def actor():
        if state["role"] is None:
            raise HTTPException(401, "Login required")
        return User("A", "admin", state["role"], "Admin")

    app.dependency_overrides[current_user] = actor
    app.dependency_overrides[get_service] = lambda: service
    with TestClient(app) as client:
        yield client, state


def payload(**overrides):
    return {"items": [{"media_id": ID}], "expected_ids": [ID], "expected_legacy_url": "/images/old.png", **overrides}


def test_read_gallery_and_safe_output(gallery_client):
    client, state = gallery_client
    state["rows"][0]["images"].insert(0, {"ma_media": str(uuid4()), "url": "https://example.test/2.jpg", "thu_tu": 1, "la_anh_chinh": False})
    response = client.get("/api/admin/media/products/SP1/images")
    assert response.status_code == 200
    assert response.json()["images"][0]["media_id"] == ID
    assert len(response.json()["images"]) == 2
    assert response.headers["cache-control"] == "no-store"
    state["rows"] = []
    assert client.get("/api/admin/media/products/missing/images").status_code == 404


def test_save_gallery_uses_snapshot_and_rpc(gallery_client):
    client, state = gallery_client
    response = client.put("/api/admin/media/products/SP1/images", json=payload(items=[]), headers=ORIGIN)
    assert response.status_code == 200
    assert state["calls"] == [("SP1", payload(items=[]))]
    assert response.headers["cache-control"] == "no-store"


@pytest.mark.parametrize("role,status", [(None, 401), ("NHAN_VIEN", 403), ("KHACH_HANG", 403)])
def test_gallery_is_admin_only(gallery_client, role, status):
    client, state = gallery_client; state["role"] = role
    assert client.get("/api/admin/media/products/SP1/images").status_code == status
    assert client.put("/api/admin/media/products/SP1/images", json=payload(), headers=ORIGIN).status_code == status
    assert not state["calls"]


@pytest.mark.parametrize("origin", [None, "https://evil.example"])
def test_save_gallery_requires_allowed_origin(gallery_client, origin):
    client, state = gallery_client
    assert client.put("/api/admin/media/products/SP1/images", json=payload(), headers={"Origin": origin} if origin else {}).status_code == 403
    assert not state["calls"]


@pytest.mark.parametrize("items", [
    [{}], [{"media_id": "invalid"}], [{"media_id": ID, "url": "https://example.test/a.jpg"}],
    [{"url": "javascript:alert(1)"}], [{"url": "//evil.example/a.jpg"}], [{"url": "https://user:password@example.test/a.jpg"}],
    [{"media_id": ID}, {"media_id": ID}], [{"url": "http://"}], [{"url": "/bad\\path"}],
    [{"media_id": str(uuid4())} for _ in range(21)],
])
def test_invalid_gallery_never_reaches_repository(gallery_client, items):
    client, state = gallery_client
    assert client.put("/api/admin/media/products/SP1/images", json=payload(items=items), headers=ORIGIN).status_code == 422
    assert not state["calls"]


@pytest.mark.parametrize("code,status", [("PGRST202", 503), ("PT409", 409), ("PT404", 404), ("PT422", 422)])
def test_gallery_maps_safe_transaction_errors(gallery_client, code, status):
    client, state = gallery_client; state["error"] = code
    response = client.put("/api/admin/media/products/SP1/images", json=payload(), headers=ORIGIN)
    assert response.status_code == status
    assert "internal SQL error" not in response.text


def test_gallery_accepts_legacy_urls_and_requires_explicit_snapshot():
    assert GalleryUpdate.model_validate(payload(items=[{"url": "/images/a.png"}, {"url": "https://example.test/a.webp"}]))
    with pytest.raises(ValueError):
        GalleryUpdate.model_validate({"items": []})
