from uuid import uuid1, uuid4
import json

import httpx
import pytest
from fastapi.testclient import TestClient
from postgrest import SyncPostgrestClient

from phub_api.config.database import get_supabase
from phub_api.dependencies.auth import current_user
from phub_api.main import app
from phub_api.models.user import User


@pytest.fixture
def warehouse_client():
    state = {'role': 'NHAN_VIEN', 'warehouse': 2, 'employee': 'NV1', 'calls': [], 'error': None}
    receipt = {'ma_phieu_nhap': -5, 'ma_phieu_code': 'PN-TEST', 'ma_ncc': 0, 'ma_kho': 2,
               'ngay_tao': '2026-10-29T10:00:00', 'trang_thai': 'NHAP', 'nguoi_tao': 'NV1', 'supplier_name': 'Supplier'}
    detail = {'receipt': receipt, 'lines': [{'sku': 'SKU1', 'product_name': 'Product', 'quantity': 2, 'unit_price': '10.25', 'unit': 'unit'}], 'version': 'a' * 64, 'replayed': False}

    def handle(request):
        body = json.loads(request.content); state['calls'].append((request.url.path, body))
        if state['error']:
            return httpx.Response(400, json=state['error'])
        if body.get('p_kind') in {'history', 'receipts'}:
            data = [] if body['p_kind'] == 'history' else [receipt | {'creator_name': 'Staff', 'line_count': 1}]
            return httpx.Response(200, json={'data': data, 'total': len(data), 'page': 1, 'page_size': 20, 'warehouse_id': 2})
        return httpx.Response(200, json=detail)

    with httpx.Client(transport=httpx.MockTransport(handle)) as transport:
        db = SyncPostgrestClient('https://offline.test/rest/v1', http_client=transport)
        app.dependency_overrides[get_supabase] = lambda: db
        app.dependency_overrides[current_user] = lambda: User('STAFF', 'staff', state['role'], 'Staff', employee_id=state['employee'], warehouse_id=state['warehouse'])
        try:
            with TestClient(app) as client:
                yield client, state
        finally:
            app.dependency_overrides.clear()


def headers(**extra):
    return {'Origin': 'http://localhost:3002', 'Idempotency-Key': str(uuid4()), **extra}


def document(**extra):
    return {'supplier_id': 0, 'note': None, 'lines': [{'sku': 'SKU1', 'quantity': 2, 'unit_price': '10.25'}], **extra}


def test_receipts_and_history_read_only_server_scoped_rpcs(warehouse_client):
    client, state = warehouse_client
    assert client.get('/api/warehouse/receipts?q=test&status=NHAP').status_code == 200
    assert client.get('/api/warehouse/receipts/-5').status_code == 200
    assert client.get('/api/warehouse/history?start=2026-10-28&end=2026-10-29').status_code == 200
    assert all(path.endswith('/rpc/warehouse_read_v1') and body['p_actor'] == 'STAFF' for path, body in state['calls'])
    query = state['calls'][-1][1]['p_query']
    assert query['start'] == '2026-10-27T17:00:00+00:00'
    assert query['end'] == '2026-10-29T17:00:00+00:00'


def test_create_edit_confirm_cancel_are_atomic_rpc_commands(warehouse_client):
    client, state = warehouse_client
    assert client.post('/api/warehouse/receipts', json=document(), headers=headers()).status_code == 201
    assert client.patch('/api/warehouse/receipts/-5', json=document(expected_version='a' * 64), headers=headers()).status_code == 200
    for action in ['confirm', 'cancel']:
        assert client.post(f'/api/warehouse/receipts/-5/{action}', json={'expected_version': 'a' * 64, **({'pricing_version': 'b' * 64} if action == 'confirm' else {})}, headers=headers()).status_code == 200
    assert [body['p_action'] for _, body in state['calls']] == ['create', 'update', 'confirm', 'cancel']
    assert all(path.endswith('/rpc/priced_receipt_v1') and body['p_actor'] == 'STAFF' and body['p_portal'] == 'WAREHOUSE' for path, body in state['calls'])
    assert state['calls'][0][1]['p_id'] is None
    assert state['calls'][0][1]['p_body']['lines'][0]['unit_price'] == '10.25'
    assert all('warehouse_id' not in body['p_body'] for _, body in state['calls'])


@pytest.mark.parametrize('role,warehouse,employee', [('ADMIN', None, 'AD1'), ('KHACH_HANG', None, None), ('NHAN_VIEN', None, 'NV1'), ('NHAN_VIEN', 1, 'NV1'), ('NHAN_VIEN', 2, None)])
def test_wrong_roles_or_missing_assignments_never_access_operations(warehouse_client, role, warehouse, employee):
    client, state = warehouse_client; state.update(role=role, warehouse=warehouse, employee=employee)
    assert client.get('/api/warehouse/history').status_code == 403
    assert client.post('/api/warehouse/receipts', json=document(), headers=headers()).status_code == 403
    assert state['calls'] == []


@pytest.mark.parametrize('body', [document(warehouse_id=2), document(actor='OTHER'), document(lines=[]),
    document(lines=[{'sku': 'X', 'quantity': -1, 'unit_price': '1'}]),
    document(lines=[{'sku': 'X', 'quantity': True, 'unit_price': '1'}]),
    document(lines=[{'sku': 'X', 'quantity': 1, 'unit_price': 'NaN'}]),
    document(lines=[{'sku': 'X', 'quantity': 1, 'unit_price': '0.001'}]),
    document(lines=[{'sku': 'X', 'quantity': 1, 'unit_price': '1'}] * 2)])
def test_invalid_or_spoofed_create_payloads_are_rejected(warehouse_client, body):
    client, state = warehouse_client
    assert client.post('/api/warehouse/receipts', json=body, headers=headers()).status_code == 422
    assert state['calls'] == []


def test_origin_key_version_dates_and_ids_are_required(warehouse_client):
    client, state = warehouse_client
    assert client.post('/api/warehouse/receipts', json=document(), headers=headers(Origin='https://evil.test')).status_code == 403
    assert client.post('/api/warehouse/receipts', json=document(), headers=headers(**{'Idempotency-Key': str(uuid1())})).status_code == 422
    assert client.post('/api/warehouse/receipts/-5/confirm', json={}, headers=headers()).status_code == 422
    assert client.get('/api/warehouse/receipts/2147483648').status_code == 422
    assert client.get('/api/warehouse/history?start=2026-10-30&end=2026-10-01').status_code == 422
    assert client.get('/api/warehouse/receipts?status=UNKNOWN').status_code == 422
    assert client.get('/api/warehouse/history?end=9999-12-31').status_code == 422
    assert client.get('/api/warehouse/history?start=0001-01-01').status_code == 422
    assert state['calls'] == []


def test_decimal_prices_are_normalized_before_the_transaction(warehouse_client):
    client, state = warehouse_client
    payload = document(lines=[{'sku': 'SKU1', 'quantity': 1, 'unit_price': '1E+3'}])
    assert client.post('/api/warehouse/receipts', json=payload, headers=headers()).status_code == 201
    assert state['calls'][0][1]['p_body']['lines'][0]['unit_price'] == '1000'


@pytest.mark.parametrize('code,message,status', [('P0001', 'NOT_FOUND', 404), ('P0001', 'STATE_CONFLICT', 409),
    ('P0001', 'DOCUMENT_CHANGED', 409), ('P0001', 'IDEMPOTENCY_CONFLICT', 409), ('P0001', 'WAREHOUSE_FORBIDDEN', 403),
    ('PGRST202', 'missing function', 503), ('23503', 'foreign key', 422)])
def test_database_errors_have_actionable_safe_status(warehouse_client, code, message, status):
    client, state = warehouse_client; state['error'] = {'code': code, 'message': message, 'details': '', 'hint': ''}
    assert client.post('/api/warehouse/receipts/-5/confirm', json={'expected_version': 'a' * 64, 'pricing_version': 'b' * 64}, headers=headers()).status_code == status


def test_unauthenticated_staff_endpoints_are_closed():
    with TestClient(app) as client:
        assert client.get('/api/warehouse/receipts').status_code == 401
        assert client.get('/api/warehouse/history').status_code == 401
