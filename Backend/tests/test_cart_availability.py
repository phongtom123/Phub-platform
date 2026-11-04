import httpx
import pytest
from phub_api.schemas.commerce import CartItem, CheckoutLine
from phub_api.schemas.orders import OrderItem



def test_public_stock_sums_warehouses_and_subtracts_reservations(catalog_client):
    client, state, requests, _ = catalog_client
    def handle(request):
        if request.url.path.endswith('/SAN_PHAM'):
            return httpx.Response(200, json=[{'sku': 'A'}])
        if request.url.path.endswith('/TON_KHO'):
            return httpx.Response(200, json=[{'sku': 'A', 'ma_kho': 1, 'so_luong_ton': 100},
                {'sku': 'A', 'ma_kho': 2, 'so_luong_ton': 60}, {'sku': 'A', 'ma_kho': 3, 'so_luong_ton': 2}])
        return httpx.Response(200, json=[{'sku': 'A', 'ma_kho_xuat': 1, 'so_luong': 10, 'order': {'invoice': {'ma_donhang': 'I'}, 'payments': []}},
            {'sku': 'A', 'ma_kho_xuat': 1, 'so_luong': 5, 'order': {'invoice': None, 'payments': [{'ma_thanh_toan': 1}]}}, {'sku': 'A', 'ma_kho_xuat': 3, 'so_luong': 3, 'order': {'invoice': {'ma_donhang': 'J'}, 'payments': []}},
            {'sku': 'A', 'ma_kho_xuat': 2, 'so_luong': 60, 'order': {'invoice': None, 'payments': []}}])
    state['handler'] = handle
    response = client.get('/api/catalog/availability', params=[('sku', 'A'), ('sku', 'PRIVATE'), ('sku', 'A')])
    assert response.status_code == 200, response.text
    assert response.json() == {'items': [{'sku': 'A', 'available_quantity': 145}], 'tax_rate': '10.00', 'currency': 'VND'}
    product = next(r for r in requests if r.url.path.endswith('/SAN_PHAM'))
    assert product.url.params['trang_thai'] == 'eq.1'
    assert product.url.params['category.trang_thai'] == 'eq.1'
    assert product.url.params['subcategory.trang_thai'] == 'eq.1'
    stock = next(r for r in requests if r.url.path.endswith('/TON_KHO'))
    assert stock.url.params['warehouse.trang_thai'] == 'eq.1'
    assert 'PRIVATE' not in stock.url.params['sku']
    reserved = next(r for r in requests if r.url.path.endswith('/CT_DON_HANG'))
    assert reserved.url.params['order.trang_thai'] == 'in.(MOI,XAC_NHAN,DANG_CHUAN_BI)'
    assert reserved.url.params['order.payments.trang_thai'] == 'eq.THANH_CONG'
    assert reserved.url.params['order.payments.loai_giao_dich'] == 'eq.THU'
    assert all(r.method == 'GET' for r in requests)


@pytest.mark.parametrize('params', [{}, {'sku': ''}, {'sku': 'A'*101}, [('sku', str(i)) for i in range(101)]])
def test_stock_request_bounds(catalog_client, params):
    client, _, requests, _ = catalog_client
    assert client.get('/api/catalog/availability', params=params).status_code == 422
    assert requests == []


def test_stock_configuration_failure_is_retryable(catalog_client, monkeypatch):
    client, _, requests, _ = catalog_client
    monkeypatch.setenv('ORDER_TAX_RATE', 'invalid')
    assert client.get('/api/catalog/availability', params={'sku': 'A'}).status_code == 503
    assert requests == []


def stock_handler(state, product_row, stock, reservations):
    def handle(request):
        assert request.method == "GET", "Adding to a local cart must not reserve or write stock"
        params = request.url.params
        table = request.url.path.rsplit("/", 1)[-1]
        if table == "SAN_PHAM":
            assert params["ma_sp"] == "eq.SP001"
            assert params["trang_thai"] == "in.(1,2)"
            assert params["category.trang_thai"] == params["subcategory.trang_thai"] == "eq.1"
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
        [{"sku": "MSI-001", "ma_kho_xuat": 1, "so_luong": 4, "order": {"invoice": {"ma_donhang": "INVOICE"}, "payments": []}}])
    response = web.get("/api/catalog/products/SP001/availability", params={"quantity": quantity})
    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store"
    assert response.json() == {"id": "SP001", "sku": "MSI-001", "quantity": quantity, "available": expected, "is_active": True}
    assert "so_luong_ton" not in response.text and "ma_kho" not in response.text
    assert all(call.method == "GET" for call in calls)


def test_cart_availability_combines_active_warehouses(catalog_client, product_row):
    web, state, _, _ = catalog_client
    stock_handler(state, product_row,
        [{"sku": "MSI-001", "ma_kho": 1, "so_luong_ton": 4}, {"sku": "MSI-001", "ma_kho": 2, "so_luong_ton": 4}], [])
    assert web.get("/api/catalog/products/SP001/availability?quantity=6").json()["available"] is True
    assert web.get("/api/catalog/products/SP001/availability?quantity=8").json()["available"] is True
    assert web.get("/api/catalog/products/SP001/availability?quantity=9").json()["available"] is False


def test_paused_product_is_not_purchasable_even_if_stock_exists(catalog_client, product_row):
    web, state, requests, _ = catalog_client
    product_row["trang_thai"] = 2
    def handle(request):
        assert request.method == "GET"
        assert request.url.path.endswith("/SAN_PHAM"), "Paused products must not read or reserve stock"
        assert request.url.params["trang_thai"] == "in.(1,2)"
        return httpx.Response(200, json=[product_row])
    state["handler"] = handle
    response = web.get("/api/catalog/products/SP001/availability?quantity=1")
    assert response.status_code == 200
    assert response.json() == {"id": "SP001", "sku": "MSI-001", "quantity": 1, "available": False, "is_active": False}
    assert len(requests) == 1


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
