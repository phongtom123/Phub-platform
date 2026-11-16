from phub_api.services import catalog_cache


def test_categories_and_brands_are_served_from_cache_on_repeat(catalog_client):
    client, state, requests, _ = catalog_client
    state["categories"] = [{"ma_loai_sp": "LAPTOP", "ten_loai_sp": "Laptop"}]
    first = client.get("/api/catalog/categories")
    brands = client.get("/api/catalog/brands")
    used = len(requests)
    assert client.get("/api/catalog/categories").json() == first.json()
    assert client.get("/api/catalog/brands").json() == brands.json()
    assert len(requests) == used


def test_facets_cache_is_keyed_by_filters(catalog_client):
    client, _, requests, _ = catalog_client
    assert client.get("/api/catalog/facets?category_id=LAPTOP").status_code == 200
    used = len(requests)
    client.get("/api/catalog/facets?category_id=LAPTOP")
    assert len(requests) == used
    client.get("/api/catalog/facets?category_id=PC")
    assert len(requests) > used


def test_cache_can_be_disabled(catalog_client, monkeypatch):
    monkeypatch.setenv("CATALOG_CACHE_SECONDS", "0")
    client, _, requests, _ = catalog_client
    client.get("/api/catalog/brands")
    used = len(requests)
    client.get("/api/catalog/brands")
    assert len(requests) > used


def test_cached_value_is_a_private_copy():
    value = catalog_cache.cached("copy-test", 60, lambda: {"items": [1]})
    value["items"].append(2)
    assert catalog_cache.cached("copy-test", 60, lambda: {"items": []}) == {"items": [1]}


def test_cache_entries_expire(monkeypatch):
    now = [1000.0]
    monkeypatch.setattr(catalog_cache.time, "monotonic", lambda: now[0])
    assert catalog_cache.cached("ttl-test", 30, lambda: "old") == "old"
    now[0] += 31
    assert catalog_cache.cached("ttl-test", 30, lambda: "new") == "new"
