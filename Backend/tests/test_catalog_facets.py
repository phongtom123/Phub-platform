from copy import deepcopy
import json

import httpx
import pytest

from phub_api.schemas.catalog import CatalogQuery
from phub_api.services.catalog import CatalogService


@pytest.fixture
def facets_catalog(catalog_client, product_row):
    web, state, calls, _ = catalog_client
    products = []
    for identifier, kind, specs, brand in [
        ("P1", "PC", {"CPU": "Core i5", "RAM": "16 GB", "Màu sắc": "Đen"}, "Build"),
        ("P2", "PC", {"CPU": "Core i7", "RAM": "32 GB", "Màu sắc": "Trắng"}, "Build"),
        ("P3", "PC", {"CPU": "Core i5", "RAM": "32 GB", "Màu sắc": "Đen"}, "Other"),
        ("C1", "CPU", {"Socket": "LGA1700", "TDP": "125W"}, "Intel"),
        ("C2", "CPU", {"Socket": "AM5", "TDP tiêu thụ": "120W"}, "AMD"),
    ]:
        products.append({**deepcopy(product_row), "ma_sp": identifier, "sku": identifier,
                         "category": {"ma_loai_sp": "COMP", "ten_loai_sp": "Products", "trang_thai": 1},
                         "subcategory": {"ma_loai_sp_con": kind, "ten_loai_sp_con": kind, "trang_thai": 1},
                         "thuong_hieu": brand, "thong_so_ky_thuat": json.dumps(specs), "gia_ban_hien_tai": "100.00"})

    def handle(request):
        assert request.method == "GET"
        assert request.url.path.endswith("/SAN_PHAM")
        params = request.url.params
        assert params["trang_thai"] == params["category.trang_thai"] == params["subcategory.trang_thai"] == "eq.1"
        data = list(products)
        for parameter, field in [("ma_loai_sp", "category"), ("ma_loai_sp_con", "subcategory")]:
            if parameter in params:
                ids = json.loads("[" + params[parameter][4:-1] + "]")
                data = [row for row in data if row[field][parameter] in ids]
        if "thuong_hieu" in params:
            data = [row for row in data if row["thuong_hieu"] == params["thuong_hieu"][3:]]
        total = len(data)
        start, limit = int(params.get("offset", 0)), int(params.get("limit", 500))
        return httpx.Response(200, json=data[start:start + limit], headers={"content-range": f"{start}-{max(start,total-1)}/{total}"})

    state["handler"] = handle
    return web, products, calls


def selection(key, value):
    return ("spec", json.dumps([key, value]))


def test_facets_only_expose_specifications_and_brands_in_the_selected_type(facets_catalog):
    web, _, calls = facets_catalog
    pc = web.get("/api/catalog/facets?subcategory_id=PC").json()
    assert {facet["key"] for facet in pc["specs"]} == {"cpu", "ram", "mau-sac"}
    assert {brand["value"] for brand in pc["brands"]} == {"Build", "Other"}
    cpu = web.get("/api/catalog/facets?subcategory_id=CPU").json()
    assert {facet["key"] for facet in cpu["specs"]} == {"socket", "tdp"}
    assert {brand["value"] for brand in cpu["brands"]} == {"Intel", "AMD"}
    assert all("gia_nhap" not in str(body) for body in [pc, cpu])
    assert all(call.method == "GET" for call in calls)


def test_spec_options_are_or_within_a_field_and_and_across_fields_before_pagination(facets_catalog):
    web, _, _ = facets_catalog
    params = [("subcategory_id", "PC"), selection("cpu", "Core i5"), selection("cpu", "Core i7"), selection("ram", "32 GB"), ("page_size", 1), ("page", 2)]
    data = web.get("/api/catalog/products", params=params).json()
    assert [product["id"] for product in data["items"]] == ["P3"]
    assert data["pagination"]["total"] == data["pagination"]["total_pages"] == 2
    params[0] = ("subcategory_id", "CPU")
    assert web.get("/api/catalog/products", params=params).json()["pagination"]["total"] == 0


def test_counts_exclude_the_current_facet_and_disable_incompatible_combinations(facets_catalog):
    web, _, _ = facets_catalog
    data = web.get("/api/catalog/facets", params=[("subcategory_id", "PC"), selection("ram", "16 GB"), selection("cpu", "Core i5")]).json()
    groups = {facet["key"]: {option["value"]: option["count"] for option in facet["options"]} for facet in data["specs"]}
    assert groups["cpu"] == {"Core i5": 1, "Core i7": 0}
    assert groups["ram"] == {"16 GB": 1, "32 GB": 1}
    assert data["total"] == 1


def test_parent_and_child_intersection_cannot_leak_other_types(facets_catalog):
    web, _, _ = facets_catalog
    body = web.get("/api/catalog/facets?category_id=WRONG&subcategory_id=PC").json()
    assert body == {"specs": [], "brands": [], "total": 0}


@pytest.mark.parametrize("encoded", ["not-json", "{}", '["ram"]', '["ram",true]', '["", "16 GB"]', '["ram", "bad\\u0001"]', json.dumps(["ram", "x" * 513])])
def test_invalid_spec_selection_is_rejected_before_database(catalog_client, encoded):
    web, _, calls, _ = catalog_client
    assert web.get("/api/catalog/products", params={"spec": encoded}).status_code == 422
    assert calls == []


def test_component_references_use_the_same_resolved_values_for_facets_and_filtering(product_row):
    class Repository:
        currency = "VND"
        def products(self, filters):
            return [{**product_row, "thong_so_ky_thuat": "CPU: SP046"}]
        def component_names(self, ids):
            return {"SP046": "Intel Core i9"}
    service = CatalogService(Repository())
    filters = CatalogQuery(spec=[json.dumps(["cpu", "Intel Core i9"])])
    assert service.facets(filters).specs[0].options[0].value == "Intel Core i9"
    assert service.list_products(filters).pagination.total == 1
