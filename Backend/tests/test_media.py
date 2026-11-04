from io import BytesIO
from types import SimpleNamespace
import re

import pytest
import httpx
from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image
from storage3.exceptions import StorageApiError

from phub_api.models.user import User
from phub_api.dependencies.auth import current_user
from phub_api.middleware.errors import register_errors
from phub_api.services.media import MAX_BYTES, store_image
from phub_api.repositories.media import MediaRepository
from phub_api.controllers.media import customer_router, router
from phub_api.config.database import get_supabase

ORIGIN = {"Origin": "http://localhost:3000"}


def image_bytes(kind="PNG", size=(8, 6)):
    output = BytesIO()
    image = Image.new("RGB", size, "red")
    exif = Image.Exif(); exif[0x010E] = "private metadata"
    image.save(output, format=kind, exif=exif)
    return output.getvalue()


@pytest.fixture
def media_client(monkeypatch):
    monkeypatch.setenv("SUPABASE_MEDIA_BUCKET", "media")
    monkeypatch.setenv("FRONTEND_ORIGINS", "http://localhost:3000")
    state = {"role": "ADMIN", "public": True, "error": None, "uploads": [], "removed": [], "buckets": [], "media": [], "avatars": {}}
    class Storage:
        def get_bucket(self, name):
            state["buckets"].append(name)
            if state["error"]: raise state["error"]
            return SimpleNamespace(public=state["public"])
        def from_(self, name):
            assert name == "media"
            return self
        def upload(self, **options):
            state["uploads"].append(options)
        def get_public_url(self, path):
            return "https://example.supabase.co/storage/v1/object/public/media/" + path
        def remove(self, paths):
            state["removed"].extend(paths)
    class Query:
        def __init__(self, table, operation, values=None):
            self.table, self.operation, self.values, self.filters = table, operation, values, {}
        def eq(self, field, value): self.filters[field] = value; return self
        def limit(self, count): assert count == 1; return self
        def execute(self):
            if self.table == "MEDIA" and self.operation == "select":
                return SimpleNamespace(data=[row for row in state["media"] if row["ma_media"] == self.filters["ma_media"]][:1])
            if self.table == "MEDIA" and self.operation == "insert":
                row = {"ma_media": "00000000-0000-0000-0000-000000000001", **self.values}
                state["media"].append(row)
                return SimpleNamespace(data=[row])
            assert self.table == "TAI_KHOAN" and self.operation == "update"
            account_id = self.filters["ma_tk"]
            state["avatars"][account_id] = self.values["ma_media_anh_dai_dien"]
            return SimpleNamespace(data=[{"ma_tk": account_id, **self.values}])
    class Table:
        def __init__(self, name): self.name = name
        def insert(self, values): return Query(self.name, "insert", values)
        def update(self, values): return Query(self.name, "update", values)
        def select(self, fields):
            assert fields == "ma_media,url,chieu_rong,chieu_cao"
            return Query(self.name, "select")
    class Database:
        storage = Storage()
        def table(self, name):
            assert name in {"MEDIA", "TAI_KHOAN"}
            return Table(name)
    app = FastAPI()
    app.include_router(router); app.include_router(customer_router); register_errors(app)
    app.dependency_overrides[current_user] = lambda: User(
        "TK1", "test", state["role"], "Test", customer_id="KH1" if state["role"] == "KHACH_HANG" else None)
    app.dependency_overrides[get_supabase] = Database
    with TestClient(app) as client:
        yield client, state, app


@pytest.mark.parametrize("kind,mime", [("PNG", "image/png"), ("JPEG", "image/jpeg"), ("WEBP", "image/webp")])
def test_upload_normalizes_and_strips_metadata(media_client, kind, mime):
    client, state, _ = media_client
    response = client.post("/api/admin/media/images", content=image_bytes(kind), headers={**ORIGIN, "Content-Type": mime})
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["media_id"] == "00000000-0000-0000-0000-000000000001"
    assert body["bucket"] == "media" and body["content_type"] == "image/webp"
    assert re.fullmatch(r"products/[0-9a-f]{32}\.webp", body["path"])
    assert (body["width"], body["height"]) == (8, 6)
    upload = state["uploads"][0]
    assert upload["path"] == body["path"]
    assert upload["file_options"]["upsert"] == "false"
    assert upload["file_options"]["content-type"] == "image/webp"
    with Image.open(BytesIO(upload["file"])) as image:
        assert image.format == "WEBP" and not image.getexif()
    assert body["size"] == len(upload["file"])
    assert state["media"][0]["storage_path"] == body["path"]
    assert response.headers["cache-control"] == "no-store"


def test_promotion_banner_upload_and_read(media_client):
    client, state, _ = media_client
    response = client.post("/api/admin/media/images?purpose=promotion_banner", content=image_bytes(),
                           headers={**ORIGIN, "Content-Type": "image/png"})
    assert response.status_code == 201, response.text
    body = response.json()
    assert re.fullmatch(r"promotions/[0-9a-f]{32}\.webp", body["path"])
    image = client.get(f'/api/admin/media/images/{body["media_id"]}')
    assert image.status_code == 200, image.text
    assert image.json() == {"media_id": body["media_id"], "url": body["url"], "width": 8, "height": 6}
    assert image.headers["cache-control"] == "no-store"
    assert client.get("/api/admin/media/images/not-a-uuid").status_code == 422
    assert client.get("/api/admin/media/images/00000000-0000-0000-0000-000000000002").status_code == 404
    state["role"] = "KHACH_HANG"
    assert client.get(f'/api/admin/media/images/{body["media_id"]}').status_code == 403


def test_promotion_banner_payload_and_invalid_purpose(media_client):
    from fastapi import HTTPException
    from phub_api.services.tables import read_payload

    media_id = "00000000-0000-0000-0000-000000000001"
    assert read_payload({"ma_media_banner": media_id}, "promotions", True) == {"ma_media_banner": media_id}
    assert read_payload({"ma_media_banner": None}, "promotions", True) == {"ma_media_banner": None}
    with pytest.raises(HTTPException) as exc:
        read_payload({"ma_media_banner": "not-a-uuid"}, "promotions", True)
    assert exc.value.status_code == 422
    client, state, _ = media_client
    response = client.post("/api/admin/media/images?purpose=other", content=image_bytes(),
                           headers={**ORIGIN, "Content-Type": "image/png"})
    assert response.status_code == 422 and not state["uploads"]


@pytest.mark.parametrize("role", ["NHAN_VIEN", "KHACH_HANG"])
def test_non_admin_cannot_upload(media_client, role):
    client, state, _ = media_client; state["role"] = role
    assert client.post("/api/admin/media/images", content=image_bytes(), headers={**ORIGIN, "Content-Type": "image/png"}).status_code == 403
    assert not state["buckets"] and not state["uploads"]


def test_customer_uploads_avatar_only_for_own_account(media_client):
    client, state, _ = media_client
    state["role"] = "KHACH_HANG"
    response = client.post("/api/customer/me/avatar", content=image_bytes(),
                           headers={**ORIGIN, "Content-Type": "image/png"})
    assert response.status_code == 201, response.text
    assert re.fullmatch(r"avatars/[0-9a-f]{32}\.webp", response.json()["path"])
    assert state["avatars"] == {"TK1": response.json()["media_id"]}


def test_unauthenticated_before_storage_initialization(media_client):
    client, state, app = media_client
    del app.dependency_overrides[current_user]
    assert client.post("/api/admin/media/images", content=image_bytes(), headers={**ORIGIN, "Content-Type": "image/png"}).status_code == 401
    assert not state["buckets"]


@pytest.mark.parametrize("origin", [None, "https://evil.example"])
def test_csrf_origin_required(media_client, origin):
    client, state, _ = media_client
    headers = {"Content-Type": "image/png"}
    if origin: headers["Origin"] = origin
    assert client.post("/api/admin/media/images", content=image_bytes(), headers=headers).status_code == 403
    assert not state["uploads"]


@pytest.mark.parametrize("content,mime,status", [
    (b"", "image/png", 422), (b"<html>fake</html>", "image/png", 422),
    (b"<svg/>", "image/svg+xml", 415), (b"{}", "application/json", 415),
    (image_bytes(), "image/jpeg", 415), (b"x" * (MAX_BYTES + 1), "image/png", 413),
], ids=["empty", "fake-image", "svg", "json", "mime-mismatch", "too-large"])
def test_invalid_uploads_never_reach_storage(media_client, content, mime, status):
    client, state, _ = media_client
    assert client.post("/api/admin/media/images", content=content, headers={**ORIGIN, "Content-Type": mime}).status_code == status
    assert not state["uploads"]


def test_chunked_body_size_and_dimensions(media_client, monkeypatch):
    client, state, _ = media_client
    import phub_api.services.media as media
    monkeypatch.setattr(media, "MAX_BYTES", 64)
    assert client.post("/api/admin/media/images", content=iter([b"a" * 40, b"b" * 40]), headers={**ORIGIN, "Content-Type": "image/png"}).status_code == 413
    monkeypatch.setattr(media, "MAX_BYTES", MAX_BYTES)
    monkeypatch.setattr(media, "MAX_SIDE", 4)
    assert client.post("/api/admin/media/images", content=image_bytes(), headers={**ORIGIN, "Content-Type": "image/png"}).status_code == 422
    assert not state["uploads"]


def test_corrupt_png_checksum_is_validation_error_not_server_error(media_client):
    client, state, _ = media_client
    data = bytearray(image_bytes())
    start = data.index(b"IDAT")
    data[start + 4] ^= 1
    response = client.post("/api/admin/media/images", content=bytes(data), headers={**ORIGIN, "Content-Type": "image/png"})
    assert response.status_code == 422
    assert not state["uploads"]


def test_private_or_missing_bucket_no_writes_or_secret_leak(media_client):
    client, state, _ = media_client
    state["public"] = False
    assert client.post("/api/admin/media/images", content=image_bytes(), headers={**ORIGIN, "Content-Type": "image/png"}).status_code == 503
    state["error"] = StorageApiError("secret service key should not escape", "NoSuchBucket", 404)
    response = client.post("/api/admin/media/images", content=image_bytes(), headers={**ORIGIN, "Content-Type": "image/png"})
    assert response.status_code == 503 and "secret" not in response.text
    assert not state["uploads"]


def test_upload_documented(media_client):
    _, _, app = media_client
    operation = app.openapi()["paths"]["/api/admin/media/images"]["post"]
    assert set(operation["requestBody"]["content"]) == {"image/png", "image/jpeg", "image/webp"}
    assert operation["security"] == [{"BearerAuth": []}, {"SessionCookie": []}]


def test_real_storage_sdk_contract_with_mock_http(monkeypatch):
    from storage3 import SyncStorageClient
    monkeypatch.setenv("SUPABASE_MEDIA_BUCKET", "media")
    calls = []
    def handle(request):
        calls.append(request)
        if request.method == "GET":
            assert request.url.path == "/storage/v1/bucket/media"
            return httpx.Response(200, json={"id": "media", "name": "media", "owner": "test",
                "public": True, "created_at": "2026-10-15T00:00:00Z", "updated_at": "2026-10-15T00:00:00Z",
                "file_size_limit": MAX_BYTES, "allowed_mime_types": ["image/webp"]})
        assert request.method == "POST"
        assert request.url.path.startswith("/storage/v1/object/media/products/")
        assert request.headers["x-upsert"] == "false"
        assert b"image/webp" in request.content and b"RIFF" in request.content
        return httpx.Response(200, json={"Key": request.url.path.removeprefix("/storage/v1/object/")})
    with httpx.Client(transport=httpx.MockTransport(handle)) as http:
        storage = SyncStorageClient("https://example.supabase.co/storage/v1/", {}, http_client=http)
        class Query:
            def insert(self, values): self.values = values; return self
            def execute(self):
                return SimpleNamespace(data=[{"ma_media": "00000000-0000-0000-0000-000000000001", **self.values}])
        class Database:
            def __init__(self): self.storage = storage
            def table(self, name): assert name == "MEDIA"; return Query()
        result = store_image(image_bytes(), "image/png", MediaRepository(Database()))
    assert result.url == "https://example.supabase.co/storage/v1/object/public/media/" + result.path
    assert len(calls) == 2
