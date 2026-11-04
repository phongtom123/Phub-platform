import httpx
import pytest


def test_purchase_states_batch_preserves_visibility_and_reservations(catalog_client):
    web, state, calls, _ = catalog_client

    def handle(request):
        assert request.method == "GET"
        table = request.url.path.rsplit("/", 1)[-1]
        if table == "SAN_PHAM":
            assert request.url.params["trang_thai"] == "in.(1,2)"
            assert request.url.params["category.trang_thai"] == request.url.params["subcategory.trang_thai"] == "eq.1"
            assert not any(field in request.url.params["select"] for field in ["MEDIA", "thong_so_ky_thuat", "gia_ban", "mo_ta"])
            rows = [{"ma_sp": "PA", "sku": "A", "trang_thai": 1},
                    {"ma_sp": "PB", "sku": "B", "trang_thai": 1},
                    {"ma_sp": "PC", "sku": "C", "trang_thai": 2}]
        elif table == "CT_DON_HANG":
            assert "PRIVATE" not in request.url.params["sku"] and '"C"' not in request.url.params["sku"]
            assert request.url.params["order.trang_thai"] == "in.(MOI,XAC_NHAN,DANG_CHUAN_BI)"
            assert request.url.params["order.payments.trang_thai"] == "eq.THANH_CONG"
            rows = [{"sku": "A", "ma_kho_xuat": 1, "so_luong": 4, "order": {"invoice": {"ma_donhang": "I"}, "payments": []}},
                    {"sku": "A", "ma_kho_xuat": 2, "so_luong": 7, "order": {"invoice": None, "payments": []}}]
        else:
            assert table == "TON_KHO"
            assert request.url.params["warehouse.trang_thai"] == "eq.1"
            rows = [{"sku": "A", "ma_kho": 1, "so_luong_ton": 10}, {"sku": "A", "ma_kho": 2, "so_luong_ton": 8}]
        return httpx.Response(200, json=rows)

    state["handler"] = handle
    response = web.get("/api/catalog/purchase-states", params=[("sku", sku) for sku in ["A", "B", "C", "PRIVATE", "A"]])
    assert response.status_code == 200, response.text
    assert response.headers["Cache-Control"] == "no-store"
    assert response.json() == {"items": [
        {"id": "PA", "sku": "A", "is_active": True, "available_quantity": 14},
        {"id": "PB", "sku": "B", "is_active": True, "available_quantity": 0},
        {"id": "PC", "sku": "C", "is_active": False, "available_quantity": 0},
    ]}
    assert len(calls) == 3, "Batch uses one lightweight product read, one reservation read and one stock read"
    assert "PRIVATE" not in response.text and "ma_kho" not in response.text


def test_purchase_states_for_only_paused_or_hidden_skus_do_not_read_stock(catalog_client):
    web, state, calls, _ = catalog_client
    state["handler"] = lambda request: httpx.Response(200, json=[{"ma_sp": "P", "sku": "S", "trang_thai": 2}])
    response = web.get("/api/catalog/purchase-states?sku=S&sku=PRIVATE")
    assert response.status_code == 200 and len(calls) == 1
    assert response.json()["items"] == [{"id": "P", "sku": "S", "is_active": False, "available_quantity": 0}]


@pytest.mark.parametrize("params", [{}, {"sku": ""}, {"sku": "S" * 101}, [("sku", str(i)) for i in range(101)]])
def test_purchase_states_validate_batch_bounds_before_database(catalog_client, params):
    web, _, calls, _ = catalog_client
    assert web.get("/api/catalog/purchase-states", params=params).status_code == 422
    assert calls == []
