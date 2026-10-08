import importlib.util
import json
import re
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace
from urllib.parse import quote

import httpx
import pytest
from fastapi.testclient import TestClient
from postgrest.exceptions import APIError

from app.catalog.repository import specifications_from_text


def test_public_list_contract_and_database_visibility_filters(catalog_client):
    client, _, requests, _ = catalog_client
    response = client.get("/api/catalog/products")
    assert response.status_code == 200
    body = response.json()
    assert body["pagination"] == {"page": 1, "page_size": 20, "total": 1, "total_pages": 1}
    product = body["items"][0]
    assert product["price"] == "15990000.00"
    assert product["currency"] == "VND"
    assert product["category"] == {"id": "LAPTOP", "name": "Laptop"}
    assert product["images"] == [{"url": "https://example.test/msi.jpg", "alt": "Laptop MSI Modern"}]
    assert product["specifications"] == [{"label": "CPU", "value": "Core i5"}, {"label": "RAM", "value": "16 GB"}]
    assert "gia_nhap" not in product and "trang_thai" not in product
    params = requests[0].url.params
    assert params["trang_thai"] == "eq.1"
    assert params["category.trang_thai"] == "eq.1"
    assert "LOAI_SP!inner" in params["select"]
    assert "gia_ban_hien_tai::text" in params["select"]
    assert "gia_nhap" not in params["select"] and "*" not in params["select"]
    assert params["order"] == "ma_sp.asc"
    assert requests[0].headers["prefer"] == "count=exact"


@pytest.mark.parametrize("search", ["mSi", "MSI-001", 'a,b).or(trang_thai.eq.0)', '100%_* (a) "b" \\ c', "Máy tính"])
def test_search_is_a_quoted_literal_on_name_or_sku(catalog_client, search):
    client, _, requests, _ = catalog_client
    assert client.get("/api/catalog/products", params={"q": search}).status_code == 200
    value = requests[-1].url.params["or"]
    decoder = json.JSONDecoder()
    prefix = "(ten_sp.imatch."
    assert value.startswith(prefix)
    name_pattern, end = decoder.raw_decode(value[len(prefix):])
    suffix = value[len(prefix) + end:]
    assert suffix.startswith(",sku.imatch.")
    sku_pattern, end = decoder.raw_decode(suffix[len(",sku.imatch."):])
    assert suffix[len(",sku.imatch.") + end:] == ")"
    assert name_pattern == sku_pattern == re.escape(search)
    assert re.search(name_pattern, search.swapcase(), re.IGNORECASE)
    assert requests[-1].url.params["trang_thai"] == "eq.1"


def test_combined_filters_and_price_sort_before_pagination(catalog_client):
    client, state, requests, _ = catalog_client
    state["total"] = 21
    response = client.get("/api/catalog/products", params=[
        ("q", " MSI "), ("category_id", " LAPTOP "), ("category_id", "PC"),
        ("brand", "MSI"), ("sort", "price-desc"), ("page", "2"), ("page_size", "10"),
    ])
    assert response.status_code == 200
    assert response.json()["pagination"] == {"page": 2, "page_size": 10, "total": 21, "total_pages": 3}
    params = requests[-1].url.params
    assert params["ma_loai_sp"] == 'in.("LAPTOP","PC")'
    assert params["thuong_hieu"] == "eq.MSI"
    assert params["order"] == "gia_ban_hien_tai.desc,ma_sp.asc"
    assert params["offset"] == "10" and params["limit"] == "10"


def test_price_ascending_has_stable_tie_breaker(catalog_client):
    client, _, requests, _ = catalog_client
    assert client.get("/api/catalog/products", params={"sort": "price-asc"}).status_code == 200
    assert requests[-1].url.params["order"] == "gia_ban_hien_tai.asc,ma_sp.asc"


def test_category_ids_with_reserved_characters_cannot_add_filters(catalog_client):
    client, _, requests, _ = catalog_client
    category = 'A,B).or(x.eq.1)"\\'
    assert client.get("/api/catalog/products", params={"category_id": category}).status_code == 200
    raw = requests[-1].url.params["ma_loai_sp"]
    assert json.loads(raw[len("in.("):-1]) == category


@pytest.mark.parametrize("params", [
    {"page": "0"}, {"page": "-1"}, {"page": "1.5"}, {"page": "abc"},
    {"page_size": "0"}, {"page_size": "101"}, {"page_size": "x"},
    {"sort": "gia_nhap"}, {"q": "x" * 101}, {"brand": "x" * 101},
    {"q": "a\x00b"}, {"category_id": ""}, {"category_id": "x" * 101},
    {"category_id": [str(i) for i in range(21)]}, {"internal_flag": "true"},
])
def test_validation_returns_consistent_errors_without_database_query(catalog_client, params):
    client, _, requests, _ = catalog_client
    response = client.get("/api/catalog/products", params=params)
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert error["details"] and set(error["details"][0]) == {"field", "message"}
    assert "detail" not in response.json()
    assert requests == []


def test_blank_optional_filters_are_ignored(catalog_client):
    client, _, requests, _ = catalog_client
    assert client.get("/api/catalog/products", params={"q": "  ", "brand": "  "}).status_code == 200
    assert "or" not in requests[-1].url.params and "thuong_hieu" not in requests[-1].url.params


@pytest.mark.parametrize("total", [0, 12])
def test_empty_page_is_success_and_preserves_filtered_total(catalog_client, total):
    client, state, _, _ = catalog_client
    state.update(rows=[], total=total)
    response = client.get("/api/catalog/products", params={"page": 50, "page_size": 10})
    assert response.status_code == 200
    assert response.json()["items"] == []
    assert response.json()["pagination"]["total"] == total
    assert response.json()["pagination"]["total_pages"] == (total + 9) // 10


def test_postgrest_out_of_range_recovers_with_filtered_head_count(catalog_client):
    client, state, requests, _ = catalog_client

    def handle(request):
        if request.method == "GET":
            return httpx.Response(416, json={"code": "PGRST103", "message": "out of range", "details": None, "hint": None})
        assert request.method == "HEAD"
        assert request.url.params["thuong_hieu"] == "eq.MSI"
        assert request.url.params["trang_thai"] == "eq.1"
        return httpx.Response(200, json=[], headers={"content-range": "*/12"})

    state["handler"] = handle
    response = client.get("/api/catalog/products", params={"page": 50, "brand": "MSI"})
    assert response.status_code == 200
    assert response.json()["pagination"]["total"] == 12
    assert response.json()["items"] == []
    assert len(requests) == 2


def test_detail_uses_same_visibility_filter_and_returns_public_product(catalog_client):
    client, _, requests, _ = catalog_client
    response = client.get("/api/catalog/products/SP001")
    assert response.status_code == 200
    assert response.json()["id"] == "SP001"
    params = requests[-1].url.params
    assert params["ma_sp"] == "eq.SP001" and params["limit"] == "1"
    assert params["trang_thai"] == "eq.1" and params["category.trang_thai"] == "eq.1"


def test_missing_or_hidden_product_returns_404(catalog_client):
    client, state, _, _ = catalog_client
    state["rows"] = []
    response = client.get("/api/catalog/products/HIDDEN")
    assert response.status_code == 404
    assert response.json()["error"] == {"code": "PRODUCT_NOT_FOUND", "message": "Không tìm thấy sản phẩm.", "details": []}


@pytest.mark.parametrize("product_id", ["x" * 101, " ", "a\x00b"])
def test_invalid_product_id_is_validated(catalog_client, product_id):
    client, _, requests, _ = catalog_client
    response = client.get("/api/catalog/products/" + quote(product_id, safe=""))
    assert response.status_code == 422 and response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert requests == []


def test_missing_optional_fields_do_not_create_fake_data(catalog_client):
    client, state, _, _ = catalog_client
    state["rows"][0].update(thuong_hieu=None, mo_ta=None, thong_so_ky_thuat=None, duong_dan_anh=None)
    product = client.get("/api/catalog/products/SP001").json()
    assert product["images"] == product["specifications"] == []
    assert product["brand"] is None and product["description"] is None and product["specifications_text"] is None


def test_money_above_float_precision_is_preserved(catalog_client):
    client, state, _, _ = catalog_client
    state["rows"][0]["gia_ban_hien_tai"] = "9999999999999999.99"
    assert client.get("/api/catalog/products/SP001").json()["price"] == "9999999999999999.99"


@pytest.mark.parametrize("raw,expected", [
    (None, []), (" \n", []),
    ("[]", []), ("{}", []),
    ('{"CPU":"Core i5","RAM":"16 GB"}', [("CPU", "Core i5"), ("RAM", "16 GB")]),
    ('[{"label":"CPU","value":"Core i5"}]', [("CPU", "Core i5")]),
    ("CPU: Core i5\nCổng: USB: Type-C", [("CPU", "Core i5"), ("Cổng", "USB: Type-C")]),
    ("Thông số văn bản tự do", [("Thông số", "Thông số văn bản tự do")]),
    ('[{"label":"CPU"}]', [("Thông số", '[{"label":"CPU"}]')]),
])
def test_specification_formats_preserve_content(raw, expected):
    assert [(item.label, item.value) for item in specifications_from_text(raw)] == expected


def test_categories_are_active_and_ordered(catalog_client):
    client, state, requests, _ = catalog_client
    state["rows"] = [{"ma_loai_sp": "LAPTOP", "ten_loai_sp": "Laptop"}]
    response = client.get("/api/catalog/categories")
    assert response.status_code == 200
    assert response.json() == {"items": [{"id": "LAPTOP", "name": "Laptop"}]}
    assert requests[-1].url.path.endswith("/LOAI_SP")
    assert requests[-1].url.params["trang_thai"] == "eq.1"


def test_brands_are_unique_sorted_and_include_later_database_pages(catalog_client):
    client, state, requests, _ = catalog_client

    def handle(request):
        offset = int(request.url.params["offset"])
        rows = [{"thuong_hieu": "MSI"}] * 500 if offset == 0 else [
            {"thuong_hieu": "ASUS"}, {"thuong_hieu": None}, {"thuong_hieu": " "}, {"thuong_hieu": "MSI"},
        ]
        return httpx.Response(200, json=rows)

    state["handler"] = handle
    response = client.get("/api/catalog/brands")
    assert response.status_code == 200
    assert response.json() == {"items": [{"name": "ASUS"}, {"name": "MSI"}]}
    assert len(requests) == 2
    assert requests[1].url.params["offset"] == "500"
    assert all(request.url.params["category.trang_thai"] == "eq.1" for request in requests)


@pytest.mark.parametrize("error,status,code", [
    (httpx.ConnectError("private network details"), 503, "DATA_SERVICE_UNAVAILABLE"),
    (httpx.ReadTimeout("private timeout details"), 503, "DATA_SERVICE_UNAVAILABLE"),
    (APIError({"code": "PGRST002", "message": "private backend details"}), 503, "DATA_SERVICE_UNAVAILABLE"),
    (APIError({"code": "08006", "message": "private backend details"}), 503, "DATA_SERVICE_UNAVAILABLE"),
    (APIError({"code": "42703", "message": "private column details"}), 500, "INTERNAL_ERROR"),
    (RuntimeError("private runtime details"), 500, "INTERNAL_ERROR"),
])
@pytest.mark.parametrize("path", ["/products", "/products/SP001", "/categories", "/brands"])
def test_data_failures_are_consistent_and_do_not_expose_internal_details(catalog_client, error, status, code, path):
    client, state, _, _ = catalog_client
    state["error"] = error
    response = client.get("/api/catalog" + path)
    assert response.status_code == status
    assert response.json()["error"]["code"] == code
    assert response.json()["error"]["details"] == []
    assert "private" not in response.text


def test_invalid_database_response_is_a_sanitized_internal_error(catalog_client):
    client, state, _, _ = catalog_client
    state["rows"][0]["gia_ban_hien_tai"] = "invalid-private-price"
    response = client.get("/api/catalog/products")
    assert response.status_code == 500 and response.json()["error"]["code"] == "INTERNAL_ERROR"
    assert "private" not in response.text


def test_swagger_documents_all_endpoints_parameters_and_error_models(catalog_client):
    client, _, _, _ = catalog_client
    schema = client.get("/openapi.json").json()
    paths = schema["paths"]
    assert set(paths) == {"/api/catalog/products", "/api/catalog/products/{product_id}", "/api/catalog/categories", "/api/catalog/brands", "/api/catalog/colors"}
    operation = paths["/api/catalog/products"]["get"]
    assert operation["tags"] == ["Public Catalog"]
    assert {param["name"] for param in operation["parameters"]} == {"q", "category_id", "brand", "page", "page_size", "sort", "min_price", "max_price", "color", "stock_status"}
    for path in paths.values():
        for status in ("422", "500", "503"):
            assert path["get"]["responses"][status]["content"]["application/json"]["schema"]["$ref"].endswith("/ErrorResponse")
    assert "404" in paths["/api/catalog/products/{product_id}"]["get"]["responses"]
    assert client.get("/docs").status_code == 200


def test_configured_currency_and_status_are_scoped_to_catalog(catalog_client):
    client, _, requests, repository = catalog_client
    repository.currency, repository.active_status = "USD", 2
    response = client.get("/api/catalog/products")
    assert response.json()["items"][0]["currency"] == "USD"
    assert requests[-1].url.params["trang_thai"] == "eq.2"


@pytest.mark.parametrize("fails", [False, True])
def test_existing_products_endpoint_keeps_original_contract(monkeypatch, fails):
    calls = []

    class LegacyClient:
        def table(self, value):
            calls.append(("table", value))
            return self

        def select(self, value):
            calls.append(("select", value))
            return self

        def limit(self, value):
            calls.append(("limit", value))
            return self

        def execute(self):
            if fails:
                raise RuntimeError("legacy failure")
            return SimpleNamespace(data=[{"ma_sp": "legacy-product"}])

    stub = ModuleType("app.supabase")
    stub.supabase = LegacyClient()
    monkeypatch.setitem(sys.modules, "app.supabase", stub)
    spec = importlib.util.spec_from_file_location("app._catalog_regression_main", Path(__file__).parents[1] / "app/main.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    with TestClient(module.app) as client:
        response = client.get("/api/products")
        if fails:
            assert response.status_code == 500 and response.json() == {"detail": "legacy failure"}
        else:
            assert response.status_code == 200 and response.json() == [{"ma_sp": "legacy-product"}]
        assert "/api/catalog/products" in client.get("/openapi.json").json()["paths"]
        assert "/api/orders" in client.get("/openapi.json").json()["paths"]
    assert calls == [("table", "SAN_PHAM"), ("select", "*"), ("limit", 20)]
