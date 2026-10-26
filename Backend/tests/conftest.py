from copy import deepcopy

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from postgrest import SyncPostgrestClient

from app.catalog.repository import CatalogRepository
from app.catalog.router import get_repository, router


@pytest.fixture
def product_row():
    return {
        "ma_sp": "SP001", "sku": "MSI-001", "ten_sp": "Laptop MSI Modern",
        "thuong_hieu": "MSI", "gia_ban_hien_tai": "15990000.00",
        "mo_ta": "Laptop học tập", "thong_so_ky_thuat": "CPU: Core i5\nRAM: 16 GB",
        "don_vi": "Cai", "bao_hanh_thang": 24,
        "duong_dan_anh": "https://example.test/msi.jpg",
        "category": {"ma_loai_sp": "LAPTOP", "ten_loai_sp": "Laptop", "trang_thai": 1},
        "gia_nhap": "secret internal price", "trang_thai": 1,
    }


@pytest.fixture
def catalog_client(product_row):
    state = {"rows": [deepcopy(product_row)], "total": 1, "error": None, "handler": None}
    requests = []

    def handle(request):
        requests.append(request)
        if state["error"]:
            raise state["error"]
        if state["handler"]:
            return state["handler"](request)
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
