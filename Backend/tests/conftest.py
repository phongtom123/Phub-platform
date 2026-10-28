from copy import deepcopy

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from postgrest import SyncPostgrestClient

from phub_api.repositories.catalog import CatalogRepository
from phub_api.dependencies.catalog import get_repository
from phub_api.controllers.catalog import router


@pytest.fixture(autouse=True)
def forbid_live_http(monkeypatch):
    """Offline tests must use MockTransport, never credentials from a developer .env."""
    def blocked(*args, **kwargs):
        raise AssertionError("Live HTTP is forbidden in offline tests; override the database dependency or use MockTransport.")
    monkeypatch.setattr(httpx.HTTPTransport, "handle_request", blocked)
    # Tests must not inherit a developer's cloud/local origin configuration.
    from phub_api.config.runtime import DEFAULT_FRONTEND_ORIGINS
    monkeypatch.setenv("FRONTEND_ORIGINS", DEFAULT_FRONTEND_ORIGINS)


@pytest.fixture
def product_row():
    return {
        "ma_sp": "SP001", "sku": "MSI-001", "ten_sp": "Laptop MSI Modern",
        "thuong_hieu": "MSI", "gia_ban_hien_tai": "15990000.00",
        "mo_ta": "Laptop học tập", "thong_so_ky_thuat": "CPU: Core i5\nRAM: 16 GB",
        "don_vi": "Cai", "bao_hanh_thang": 24,
        "duong_dan_anh": "https://example.test/msi.jpg",
        "category": {"ma_loai_sp": "LAPTOP", "ten_loai_sp": "Laptop", "trang_thai": 1},
        "subcategory": {"ma_loai_sp_con": "LAPTOP_GENERAL", "ten_loai_sp_con": "Laptop phổ thông", "trang_thai": 1},
        "gia_nhap": "secret internal price", "trang_thai": 1,
    }


@pytest.fixture
def catalog_client(product_row):
    state = {"rows": [deepcopy(product_row)], "categories": [], "subcategories": [], "total": 1, "error": None, "handler": None}
    requests = []

    def handle(request):
        requests.append(request)
        if state["error"]:
            raise state["error"]
        if state["handler"]:
            return state["handler"](request)
        if request.url.path.endswith("/LOAI_SP"):
            rows = state["categories"]
        elif request.url.path.endswith("/LOAI_SP_CON"):
            rows = state["subcategories"]
        else:
            rows = state["rows"]
        headers = {"content-range": f"0-{max(0, len(rows) - 1)}/{state['total']}"}
        return httpx.Response(200, json=rows, headers=headers)

    with httpx.Client(transport=httpx.MockTransport(handle)) as http_client:
        db = SyncPostgrestClient("https://catalog.test/rest/v1", http_client=http_client)
        repository = CatalogRepository(db)
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[get_repository] = lambda: repository
        with TestClient(app) as client:
            yield client, state, requests, repository
