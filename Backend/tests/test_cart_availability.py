import httpx
import pytest

from phub_api.schemas.commerce import CartItem, CheckoutLine
from phub_api.schemas.orders import OrderItem


def stock_handler(state, product_row, stock, reservations):
    def handle(request):
        assert request.method == "GET", "Adding to a local cart must not reserve or write stock"
        params = request.url.params
        table = request.url.path.rsplit("/", 1)[-1]
        if table == "SAN_PHAM":
            assert params["ma_sp"] == "eq.SP001"
            assert params["trang_thai"] == params["category.trang_thai"] == params["subcategory.trang_thai"] == "eq.1"
            rows = [product_row]
        elif table == "CT_DON_HANG":
            assert params["order.trang_thai"] == "in.(MOI,XAC_NHAN,DANG_CHUAN_BI)"
            rows = reservations
        else:
            assert table == "TON_KHO" and params["warehouse.trang_thai"] == "eq.1"
            rows = stock
        return httpx.Response(200, json=rows, headers={"content-range": f"0-{max(0,len(rows)-1)}/{len(rows)}"})
    state["handler"] = handle


@pytest.mark.parametrize("quantity,expected", [(1, True), (6, True), (7, False), (1001, False)])
def test_public_availability_subtracts_reservations_without_disclosing_stock(catalog_client, product_row, quantity, expected):
    web, state, calls, _ = catalog_client
    stock_handler(state, product_row,
        [{"sku": "MSI-001", "ma_kho": 1, "so_luong_ton": 10}],
        [{"sku": "MSI-001", "ma_kho_xuat": 1, "so_luong": 4}])
    response = web.get("/api/catalog/products/SP001/availability", params={"quantity": quantity})
    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store"
    assert response.json() == {"id": "SP001", "sku": "MSI-001", "quantity": quantity, "available": expected}
    assert "so_luong_ton" not in response.text and "ma_kho" not in response.text
    assert all(call.method == "GET" for call in calls)


def test_cart_availability_combines_active_warehouses(catalog_client, product_row):
    web, state, _, _ = catalog_client
    stock_handler(state, product_row,
        [{"sku": "MSI-001", "ma_kho": 1, "so_luong_ton": 4}, {"sku": "MSI-001", "ma_kho": 2, "so_luong_ton": 4}], [])
    assert web.get("/api/catalog/products/SP001/availability?quantity=6").json()["available"] is True
    assert web.get("/api/catalog/products/SP001/availability?quantity=8").json()["available"] is True
    assert web.get("/api/catalog/products/SP001/availability?quantity=9").json()["available"] is False


@pytest.mark.parametrize("stock", [[], [{"sku": "MSI-001", "ma_kho": 1, "so_luong_ton": 0}]])
def test_empty_stock_is_unavailable(catalog_client, product_row, stock):
    web, state, _, _ = catalog_client
    stock_handler(state, product_row, stock, [])
    assert web.get("/api/catalog/products/SP001/availability?quantity=1").json()["available"] is False


def test_cart_quantity_can_exceed_old_1000_cap_when_available(catalog_client, product_row):
    web, state, _, _ = catalog_client
    stock_handler(state, product_row, [{"sku": "MSI-001", "ma_kho": 1, "so_luong_ton": 5000}], [])
    assert web.get("/api/catalog/products/SP001/availability?quantity=1234").json()["available"] is True
    assert CartItem(sku="MSI-001", quantity=1234).quantity == 1234
    assert OrderItem(sku="MSI-001", warehouse_id=1, quantity=1234, expected_unit_price="1.00").quantity == 1234
    assert CheckoutLine(sku="MSI-001", warehouse_id=1, name="Test", unit="unit", quantity=1234,
                        unit_price="1.00", gross_total="1234.00", discount="0.00", tax_rate="10", tax_amount="0.00", line_total="1234.00").quantity == 1234


@pytest.mark.parametrize("quantity", ["0", "-1", "1.5", "abc", "9007199254740992"])
def test_bad_cart_quantities_are_rejected_before_database(catalog_client, quantity):
    web, _, calls, _ = catalog_client
    assert web.get("/api/catalog/products/SP001/availability", params={"quantity": quantity}).status_code == 422
    assert calls == []


def test_hidden_product_has_no_public_availability(catalog_client):
    web, state, calls, _ = catalog_client
    state["rows"] = []
    assert web.get("/api/catalog/products/SP001/availability?quantity=1").status_code == 404
    assert len(calls) == 1 and calls[0].url.path.endswith("/SAN_PHAM")
