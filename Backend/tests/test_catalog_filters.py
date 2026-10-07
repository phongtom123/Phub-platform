from copy import deepcopy
from decimal import Decimal

import httpx
import pytest

from app.catalog.repository import product_color


@pytest.fixture
def filtered_catalog(catalog_client, product_row):
    web, state, calls, repository = catalog_client
    products = []
    for index, specs in enumerate(["Màu sắc: Đen", '{"Color":"đen"}', "Màu: Đỏ", None, '[{"label":"Colour","value":"Đen"}]'], 1):
        products.append({**deepcopy(product_row), "ma_sp": f"P{index}", "sku": f"SKU{index}",
                         "gia_ban_hien_tai": str(index * 100), "thong_so_ky_thuat": specs})
    stocks = [
        {"sku": "SKU1", "ma_kho": 1, "so_luong_ton": 2},
        {"sku": "SKU2", "ma_kho": 1, "so_luong_ton": 2},
        {"sku": "SKU3", "ma_kho": 3, "so_luong_ton": 99},  # inactive warehouse
        {"sku": "SKU4", "ma_kho": 2, "so_luong_ton": 4},
        {"sku": "SKU5", "ma_kho": 1, "so_luong_ton": -3},
        {"sku": "SKU5", "ma_kho": 2, "so_luong_ton": 1},
    ]
    reservations = [
        {"sku": "SKU1", "ma_kho_xuat": 1, "so_luong": 2, "status": "MOI"},
        {"sku": "SKU2", "ma_kho_xuat": 1, "so_luong": 1, "status": "XAC_NHAN"},
        {"sku": "SKU2", "ma_kho_xuat": 1, "so_luong": 100, "status": "HUY"},
    ]

    def handle(request):
        assert request.method == "GET", "Catalog must never write database rows"
        table = request.url.path.rsplit("/", 1)[-1]
        params = request.url.params
        if table == "SAN_PHAM":
            data = list(products)
            assert params["trang_thai"] == "eq.1" and params["category.trang_thai"] == "eq.1"
            if "gia_ban_hien_tai" in params:
                # SDK merges gte/lte filters on the same column into repeated keys.
                for condition in params.get_list("gia_ban_hien_tai"):
                    op, value = condition.split(".", 1)
                    data = [row for row in data if (Decimal(row["gia_ban_hien_tai"]) >= Decimal(value) if op == "gte" else Decimal(row["gia_ban_hien_tai"]) <= Decimal(value))]
            if params.get("order", "").startswith("gia_ban_hien_tai"):
                data.sort(key=lambda row: Decimal(row["gia_ban_hien_tai"]), reverse=".desc" in params["order"])
        elif table == "CT_DON_HANG":
            assert params["order.trang_thai"] == "in.(MOI,XAC_NHAN,DANG_CHUAN_BI)"
            assert "ma_kh" not in params["select"].split(",") and "ma_donhang" not in params["select"].split(",")
            data = [row for row in reservations if row["status"] in {"MOI", "XAC_NHAN", "DANG_CHUAN_BI"}]
        else:
            assert table == "TON_KHO" and params["warehouse.trang_thai"] == "eq.1"
            data = [row for row in stocks if row["ma_kho"] != 3]
        total = len(data)
        start = int(params.get("offset", 0))
        data = data[start:start + int(params.get("limit", 500))]
        return httpx.Response(200, json=data, headers={"content-range": f"{start}-{max(start, start + len(data) - 1)}/{total}"})

    state["handler"] = handle
    return web, products, calls, repository


@pytest.mark.parametrize("params", [
    {"min_price": "-1"}, {"max_price": "-1"}, {"min_price": "NaN"},
    {"min_price": "1.001"}, {"min_price": "10000000000000000"},
    {"min_price": "2", "max_price": "1"}, {"stock_status": "fake"}, {"color": "bad\x01"},
])
def test_new_filter_validation_blocks_before_database(catalog_client, params):
    web, _, calls, _ = catalog_client
    response = web.get("/api/catalog/products", params=params)
    assert response.status_code == 422 and response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert calls == []


def test_price_range_inclusive_filters_database_before_pagination(filtered_catalog):
    web, _, calls, _ = filtered_catalog
    response = web.get("/api/catalog/products?min_price=200&max_price=400&page_size=1&page=2&sort=price-desc")
    assert response.status_code == 200
    body = response.json()
    assert [product["id"] for product in body["items"]] == ["P3"]
    assert body["pagination"] == {"page": 2, "page_size": 1, "total": 3, "total_pages": 3}
    assert calls[-1].url.params.get_list("gia_ban_hien_tai") == ["gte.200", "lte.400"]


@pytest.mark.parametrize("raw, expected", [
    ('{"Màu sắc":"Đen"}', "Đen"), ('[{"label":"Color","value":"Blue"}]', "Blue"),
    ("Văn bản mô tả\nMàu: Trắng", "Trắng"), ("RAM: 16GB", None), (None, None),
])
def test_color_uses_explicit_specs_only(raw, expected):
    assert product_color(raw) == expected


def test_color_filters_all_rows_before_pagination_and_deduplicates_metadata(filtered_catalog):
    web, _, _, _ = filtered_catalog
    body = web.get("/api/catalog/products?color=ĐEN&page_size=1&page=2").json()
    assert [product["id"] for product in body["items"]] == ["P2"]
    assert body["pagination"]["total"] == 3
    body = web.get("/api/catalog/products?color=__unspecified__").json()
    assert [product["id"] for product in body["items"]] == ["P4"]
    colors = web.get("/api/catalog/colors").json()["items"]
    assert len(colors) == 3 and colors[-1]["value"] == "__unspecified__"


@pytest.mark.parametrize("status, expected", [("in-stock", ["P2", "P4", "P5"]), ("out-of-stock", ["P1", "P3"])])
def test_available_stock_accounts_for_reservations_and_inactive_warehouses(filtered_catalog, status, expected):
    web, _, _, _ = filtered_catalog
    response = web.get("/api/catalog/products", params={"stock_status": status})
    assert response.status_code == 200
    body = response.json()
    assert [product["id"] for product in body["items"]] == expected
    assert all(product["stock_status"] == status for product in body["items"])
    assert "ma_kho" not in response.text and "so_luong_ton" not in response.text


def test_combined_color_price_stock_and_empty_page_preserve_total(filtered_catalog):
    web, _, _, _ = filtered_catalog
    body = web.get("/api/catalog/products?color=đen&min_price=200&max_price=500&stock_status=in-stock&page_size=1&page=3").json()
    assert body["items"] == []
    assert body["pagination"] == {"page": 3, "page_size": 1, "total": 2, "total_pages": 2}


def test_color_scan_does_not_stop_at_first_supabase_page(filtered_catalog, monkeypatch):
    web, _, _, _ = filtered_catalog
    monkeypatch.setattr("app.catalog.availability.BATCH_SIZE", 2)
    body = web.get("/api/catalog/products?color=Đen&page_size=100").json()
    assert [product["id"] for product in body["items"]] == ["P1", "P2", "P5"]
