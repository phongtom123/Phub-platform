from datetime import datetime

import httpx
from zoneinfo import ZoneInfoNotFoundError


def banner_row():
    return {
        'ma_ctkm': 12, 'ten_chuong_trinh': '  Summer sale  ',
        'nguoi_tao': 'PRIVATE_EMPLOYEE',
        'banner': {'url': 'https://images.test/banner.webp', 'alt_text': 'Public banner',
                   'chieu_rong': 1400, 'chieu_cao': 330, 'storage_path': 'private-metadata'},
    }


def test_banners_are_public_scoped_by_status_schedule_and_media(catalog_client, monkeypatch):
    client, state, requests, _ = catalog_client
    state['rows'] = [banner_row()]
    monkeypatch.setenv('CHECKOUT_PROMOTION_TIMEZONE', 'Asia/Ho_Chi_Minh')
    response = client.get('/api/catalog/banners')
    assert response.status_code == 200
    assert response.json() == {'items': [{
        'id': 12, 'title': 'Summer sale', 'image_url': 'https://images.test/banner.webp',
        'alt_text': 'Public banner', 'width': 1400, 'height': 330,
    }]}
    request = requests[-1]
    assert request.url.path.endswith('/CHUONG_TRINH_KHUYEN_MAI')
    params = request.url.params
    assert params['trang_thai'] == 'eq.HOAT_DONG'
    assert params['ma_media_banner'] == 'not.is.null'
    assert params['ngay_bat_dau'].startswith('lte.')
    assert params['ngay_ket_thuc'] == params['ngay_bat_dau'].replace('lte.', 'gte.', 1)
    assert datetime.fromisoformat(params['ngay_bat_dau'][4:]).tzinfo is None
    assert 'banner_media_fkey!inner' in params['select']
    assert params['limit'] == '20'
    assert 'PRIVATE_EMPLOYEE' not in response.text and 'storage_path' not in response.text


def test_missing_or_unsafe_images_are_not_published(catalog_client):
    client, state, _, _ = catalog_client
    row = banner_row()
    state['rows'] = [{**row, 'banner': None}, {**row, 'banner': {'url': 'javascript:alert(1)'}},
                     {**row, 'banner': {'url': 'https://user:password@images.test/private.webp'}}]
    assert client.get('/api/catalog/banners').json() == {'items': []}
    state['rows'] = []
    assert client.get('/api/catalog/banners').json() == {'items': []}


def test_windows_without_iana_database_uses_vietnam_time(catalog_client, monkeypatch):
    client, state, _, _ = catalog_client
    state['rows'] = [banner_row()]
    def unavailable(name):
        raise ZoneInfoNotFoundError(name)
    monkeypatch.setattr('phub_api.services.catalog.ZoneInfo', unavailable)
    monkeypatch.setenv('CHECKOUT_PROMOTION_TIMEZONE', 'Asia/Ho_Chi_Minh')
    assert client.get('/api/catalog/banners').status_code == 200
    monkeypatch.setenv('CHECKOUT_PROMOTION_TIMEZONE', 'Unknown/Timezone')
    response = client.get('/api/catalog/banners')
    assert response.status_code == 503
    assert response.json()['error']['code'] == 'DATA_SERVICE_UNAVAILABLE'


def test_banner_connection_failure_is_not_an_empty_campaign(catalog_client):
    client, state, _, _ = catalog_client
    state['error'] = httpx.ReadTimeout('Unavailable')
    response = client.get('/api/catalog/banners')
    assert response.status_code == 503
    assert 'Unavailable' not in response.text
