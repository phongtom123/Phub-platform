import httpx
import pytest



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
