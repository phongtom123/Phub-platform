"""Opt-in, read-only catalog integration check. Run from Backend:

    .venv/Scripts/python.exe scripts/check_catalog.py

Uses existing .env credentials locally; prints no credentials or product data.
Never imports, inserts, updates, or deletes database records.
"""

import os
import sys
from decimal import Decimal
from pathlib import Path
from urllib.parse import quote

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient

from app.main import app
from app.supabase import supabase


def check():
    active = int(os.getenv("CATALOG_ACTIVE_STATUS", "1"))
    # Small reference sample is independent of the repository's filter logic.
    reference = (
        supabase.table("SAN_PHAM")
        .select("ma_sp,sku,ten_sp,ma_loai_sp,thuong_hieu,gia_ban_hien_tai::text,trang_thai,category:LOAI_SP(trang_thai)", count="exact")
        .order("ma_sp").limit(100).execute()
    )
    public_sample = [
        row for row in reference.data
        if row["trang_thai"] == active and row.get("category") and row["category"]["trang_thai"] == active
    ]
    full_reference = reference.count == len(reference.data)
    checks = 0
    with TestClient(app) as client:
        def get(path, params=None):
            nonlocal checks
            response = client.get(path, params=params)
            assert response.status_code == 200, f"Catalog GET failed with HTTP {response.status_code}"
            checks += 1
            return response.json()

        first = get("/api/catalog/products", {"page_size": 100})
        if full_reference:
            assert first["pagination"]["total"] == len(public_sample)
            assert [item["id"] for item in first["items"]] == [row["ma_sp"] for row in public_sample]
        for sort, descending in [("price-asc", False), ("price-desc", True)]:
            page = get("/api/catalog/products", {"page_size": 100, "sort": sort})
            keys = [(Decimal(item["price"]), item["id"]) for item in page["items"]]
            assert keys == sorted(keys, key=lambda pair: (-pair[0] if descending else pair[0], pair[1]))

        beyond = get("/api/catalog/products", {"page": first["pagination"]["total"] + 2, "page_size": 1})
        assert beyond["items"] == [] and beyond["pagination"]["total"] == first["pagination"]["total"]

        if len(public_sample) > 1:
            page1 = get("/api/catalog/products", {"page": 1, "page_size": 1})
            page2 = get("/api/catalog/products", {"page": 2, "page_size": 1})
            assert page1["items"][0]["id"] != page2["items"][0]["id"]

        if public_sample:
            sample = public_sample[0]
            detail = get("/api/catalog/products/" + quote(sample["ma_sp"], safe=""))
            assert detail["sku"] == sample["sku"]
            assert Decimal(detail["price"]) == Decimal(sample["gia_ban_hien_tai"])
            assert isinstance(detail["images"], list) and isinstance(detail["specifications"], list)
            for q in (sample["sku"].swapcase(), sample["ten_sp"][:5].swapcase()):
                found = get("/api/catalog/products", {"q": q, "page_size": 100})
                assert sample["ma_sp"] in {item["id"] for item in found["items"]}
            params = [("category_id", sample["ma_loai_sp"]), ("page_size", "100")]
            if sample["thuong_hieu"]:
                params.append(("brand", sample["thuong_hieu"]))
            filtered = get("/api/catalog/products", params)
            assert sample["ma_sp"] in {item["id"] for item in filtered["items"]}
            assert all(item["category"]["id"] == sample["ma_loai_sp"] for item in filtered["items"])
            if sample["thuong_hieu"]:
                assert all(item["brand"] == sample["thuong_hieu"] for item in filtered["items"])

        for q in ('a,b).or(trang_thai.eq.0)', '100%_* (a) "b" \\ c'):
            get("/api/catalog/products", {"q": q})
        categories = get("/api/catalog/categories")
        brands = get("/api/catalog/brands")
        if full_reference:
            assert {item["name"] for item in brands["items"]} == {
                row["thuong_hieu"] for row in public_sample if row["thuong_hieu"] and row["thuong_hieu"].strip()
            }
        assert all(set(item) == {"id", "name"} for item in categories["items"])
        hidden = next((row for row in reference.data if row not in public_sample), None)
        if hidden:
            response = client.get("/api/catalog/products/" + quote(hidden["ma_sp"], safe=""))
            assert response.status_code == 404
            checks += 1
        response = client.get("/api/catalog/products", params={"page": 0})
        assert response.status_code == 422 and response.json()["error"]["code"] == "VALIDATION_ERROR"
        checks += 1
        assert "/api/catalog/products" in get("/openapi.json")["paths"]
        assert client.get("/docs").status_code == 200
        checks += 1
    print(f"PASS: {checks} read-only integration checks; public products: {first['pagination']['total']}.")
    print("Full reference comparison:", full_reference)


if __name__ == "__main__":
    try:
        check()
    except Exception as exc:
        # Avoid dumping credentials, raw response bodies, or private DB details.
        print(f"FAIL: {type(exc).__name__}; inspect locally for schema/configuration differences.")
        raise SystemExit(1) from None
