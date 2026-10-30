from uuid import uuid4
import json

import httpx
import pytest
from fastapi.testclient import TestClient
from postgrest import SyncPostgrestClient

from phub_api.main import app
from phub_api.dependencies.auth import current_user
from phub_api.config.database import get_supabase
from phub_api.models.user import User
from phub_api.services.tables import table_filters


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv('FRONTEND_ORIGINS', 'http://localhost:3000')
    state = {'role': 'ADMIN', 'employee': 'NV1', 'error': None, 'calls': []}
    def handle(request):
        state['calls'].append((request.url.path, json.loads(request.content)))
        if state['error']:
            return httpx.Response(400, json=state['error'])
        return httpx.Response(200, json={'data': [{'ma_donhang': 'DH1'}], 'replayed': False})
    with httpx.Client(transport=httpx.MockTransport(handle)) as transport:
        db = SyncPostgrestClient('https://offline.test/rest/v1', http_client=transport)
        app.dependency_overrides[get_supabase] = lambda: db
        app.dependency_overrides[current_user] = lambda: User('AD1', 'admin', state['role'], 'Admin', employee_id=state['employee'])
        with TestClient(app) as client:
            yield client, state
        app.dependency_overrides.clear()


def post(client, action='confirm', resource='orders', data=None, **options):
    return client.post(f'/api/admin/operations/{resource}', json={'action': action, 'record_id': 'DH1', 'data': data or {}},
                       headers={'Origin': 'http://localhost:3000', 'Idempotency-Key': str(uuid4()), **options})


def test_command_only_calls_transaction_rpc_with_server_actor(client):
    http, state = client
    response = post(http)
    assert response.status_code == 200
    path, body = state['calls'][0]
    assert path.endswith('/rpc/admin_operation_v1')
    assert body['p_actor'] == 'AD1' and body['p_action'] == 'confirm'
    assert body['p_body'] == {'_expected_status': None}


@pytest.mark.parametrize('action', ['create', 'lines', 'dispatch', 'receive', 'cancel'])
def test_transfers_are_disabled_before_any_database_call(client, action):
    http, state = client
    assert post(http, action, resource='transfers').status_code == 422
    assert state['calls'] == []


@pytest.mark.parametrize('role', ['NHAN_VIEN', 'KHACH_HANG'])
def test_non_admin_has_no_operations_access(client, role):
    http, state = client
    state['role'] = role
    assert post(http).status_code == 403
    assert http.get('/api/admin/operations/read/summary').status_code == 403
    assert state['calls'] == []


def test_missing_employee_and_bad_origin_are_rejected(client):
    http, state = client
    state['employee'] = None
    assert post(http).status_code == 403
    state['employee'] = 'NV1'
    assert post(http, Origin='https://untrusted.test').status_code == 403
    assert state['calls'] == []


@pytest.mark.parametrize('action,data', [
    ('payment', {'amount': '-1', 'method': 'TIEN_MAT'}),
    ('payment', {'amount': 'NaN', 'method': 'TIEN_MAT'}),
    ('payment', {'amount': '10', 'method': 'CHUYEN_KHOAN'}),
    ('payment', {'amount': '10.001', 'method': 'TIEN_MAT'}),
    ('assign', {'employee_id': 'NV1', 'actor': 'AD2'}),
    ('confirm', {'trang_thai': 'HOAN_THANH'}),
    ('delete', {}),
])
def test_invalid_or_tampered_commands_do_not_reach_database(client, action, data):
    http, state = client
    assert post(http, action, data=data).status_code == 422
    assert state['calls'] == []


def test_signed_ids_exact_money_and_idempotency_header(client):
    http, state = client
    assert post(http, 'payment', data={'amount': '99999999999999.99', 'method': 'TIEN_MAT'}).status_code == 200
    assert state['calls'][0][1]['p_body']['amount'] == '99999999999999.99'
    response = http.post('/api/admin/operations/receipts', headers={'Origin': 'http://localhost:3000', 'Idempotency-Key': str(uuid4())},
                         json={'action': 'create', 'data': {'warehouse_id': -1, 'supplier_id': 0, 'lines': [{'sku': 'CPU', 'quantity': 2, 'unit_price': '10.25'}]}})
    assert response.status_code == 422  # Fixed warehouse policy rejects other warehouses.
    response = http.post('/api/admin/operations/receipts', headers={'Origin': 'http://localhost:3000', 'Idempotency-Key': str(uuid4())},
                         json={'action': 'create', 'data': {'warehouse_id': 2, 'supplier_id': 0, 'lines': [{'sku': 'CPU', 'quantity': 2, 'unit_price': '10.25'}]}})
    assert response.status_code == 200
    assert state['calls'][-1][1]['p_body']['supplier_id'] == 0
    assert post(http, **{'Idempotency-Key': 'invalid'}).status_code == 422


@pytest.mark.parametrize('code,message,status', [('P0001', 'STATE_CONFLICT', 409), ('P0001', 'INSUFFICIENT_STOCK', 409),
    ('P0001', 'PAYMENT_LIMIT', 409), ('P0001', 'NOT_FOUND', 404), ('PGRST202', 'missing RPC', 503), ('23505', 'duplicate', 409)])
def test_business_errors_keep_safe_status(client, code, message, status):
    http, state = client
    state['error'] = {'code': code, 'message': message, 'details': '', 'hint': ''}
    response = post(http)
    assert response.status_code == status
    assert 'secret' not in response.text.lower()


def test_summary_dates_and_ticket_ids_are_validated(client):
    http, state = client
    assert http.get('/api/admin/operations/read/summary?start=2026-10-30&end=2026-10-01').status_code == 422
    assert http.get('/api/admin/operations/read/messages?record_id=bad').status_code == 422
    assert not state['calls']


def test_table_filters_are_typed_allowlisted_and_use_vietnam_day_boundaries():
    assert table_filters('receipts', '{"ma_kho":"-3","trang_thai":"NHAP"}') == [('ma_kho', 'eq', -3), ('trang_thai', 'eq', 'NHAP')]
    assert table_filters('orders', '{"thoi_gian_dat__to":"2026-10-28"}') == [('thoi_gian_dat','lt','2026-10-28T17:00:00+00:00')]
    from fastapi import HTTPException
    for raw in ['[]', '{"mat_khau":"x"}', '{"trang_thai":{}}', '{"ma_donhang__or":"x"}']:
        with pytest.raises(HTTPException):
            table_filters('orders', raw)
