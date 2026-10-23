import json
from copy import deepcopy

import httpx
import pytest
from fastapi.testclient import TestClient
from postgrest import SyncPostgrestClient

from phub_api.config.database import get_supabase
from phub_api.dependencies.auth import current_user
from phub_api.main import app
from phub_api.models.user import User

ADMIN = User('AD1', 'admin', 'ADMIN', 'Admin', employee_id='NV1')
CUSTOMER = User('TK1', 'customer', 'KHACH_HANG', 'Khách', customer_id='KH1')
WAREHOUSE = User('WK1', 'warehouse', 'THU_KHO', 'Kho', warehouse_id=1)
TICKET = 'a1111111-1111-4111-8111-111111111111'
OTHER = 'b2222222-2222-4222-8222-222222222222'
MISSING = 'c3333333-3333-4333-8333-333333333333'
ORIGIN = {'Origin': 'http://localhost:3000'}
BASE = '/api/crm/feedback'
CUSTOMER_BASE = '/api/customer/crm/feedback'
ROW = {'ma_phan_hoi': TICKET, 'ma_kh': 'KH1', 'tieu_de': 'Cần hỗ trợ', 'noi_dung': 'Nội dung\nDòng thứ hai',
       'ma_sp': None, 'ma_donhang': None, 'trang_thai': 'MOI', 'muc_do_uu_tien': 'BINH_THUONG',
       'nguoi_xu_ly': None, 'phan_hoi_quan_ly': None, 'ngay_phan_hoi': None,
       'ngay_tao': '2026-10-23T01:00:00Z', 'cap_nhat_luc': '2026-10-23T01:00:00Z',
       'khach': {'ten_kh': 'Khách Một'}, 'nhan_vien': None}


@pytest.fixture
def support_client(monkeypatch):
    monkeypatch.setenv('FRONTEND_ORIGINS', 'http://localhost:3000')
    state = {'actor': ADMIN, 'requests': [], 'rpc_error': None,
             'rows': [deepcopy(ROW), {**deepcopy(ROW), 'ma_phan_hoi': OTHER, 'ma_kh': 'KH2'}]}

    def handle(request):
        state['requests'].append(request)
        endpoint = request.url.path.split('/')[-1]
        if endpoint in {'customer_create_feedback_v1', 'admin_update_feedback_v1'}:
            if state['rpc_error']:
                return httpx.Response(400, json={'code': state['rpc_error'], 'message': 'private SQL and credentials', 'details': None, 'hint': None})
            data = json.loads(request.content)
            result = deepcopy(ROW)
            if endpoint == 'customer_create_feedback_v1':
                assert data['p_actor_account_id'] == 'TK1'
                result.update(data['p_payload'])
            else:
                assert data['p_actor_account_id'] == 'AD1'
                result.update({k: v for k, v in data['p_changes'].items() if k != 'nhan_xu_ly'})
                if data['p_changes'].get('nhan_xu_ly'):
                    result['nguoi_xu_ly'] = 'NV1'
                    result['ten_nguoi_xu_ly'] = 'Admin'
            return httpx.Response(200, json=result)
        assert endpoint == 'PHAN_HOI' and request.method == 'GET'
        rows = state['rows']
        for key, value in request.url.params.multi_items():
            if value.startswith('eq.'):
                rows = [row for row in rows if str(row.get(key)) == value[3:]]
        total = len(rows)
        offset, limit = int(request.url.params.get('offset', 0)), int(request.url.params.get('limit', 20))
        return httpx.Response(200, json=rows[offset:offset+limit], headers={'Content-Range': f'{offset}-{offset+len(rows)-1}/{total}'})

    with httpx.Client(transport=httpx.MockTransport(handle)) as transport:
        db = SyncPostgrestClient('https://support.test/rest/v1', http_client=transport)
        app.dependency_overrides[current_user] = lambda: state['actor']
        app.dependency_overrides[get_supabase] = lambda: db
        try:
            with TestClient(app) as client:
                yield client, state
        finally:
            app.dependency_overrides.clear()


def test_admin_inbox_and_detail(support_client):
    client, state = support_client
    response = client.get(BASE + '?page_size=1')
    assert response.status_code == 200 and response.headers['cache-control'] == 'no-store'
    assert response.json()['total'] == 2 and len(response.json()['data']) == 1
    assert response.json()['data'][0]['ten_kh'] == 'Khách Một'
    assert client.get(BASE + '/' + TICKET).status_code == 200
    assert client.get(BASE + '/' + MISSING).status_code == 404
    assert client.get(BASE + '/invalid-id').status_code == 422
    assert client.get(BASE + '?status=NOPE').status_code == 422
    assert client.get(BASE + '?page_size=101').status_code == 422


def test_filtering_and_literal_search(support_client):
    client, state = support_client
    assert client.get(BASE + '?status=DA_DONG').json()['data'] == []
    assert client.get(BASE + '?priority=CAO').json()['data'] == []
    response = client.get(BASE, params={'q': 'bad),ma_kh.eq.KH2'})
    assert response.status_code == 200
    assert 'ma_kh' not in state['requests'][-1].url.params
    assert 'tieu_de.imatch.' in state['requests'][-1].url.params['or']


@pytest.mark.parametrize('actor', [CUSTOMER, WAREHOUSE])
@pytest.mark.parametrize('method,suffix,body', [('GET', '', None), ('GET', '/' + TICKET, None),
                                              ('PATCH', '/' + TICKET, {'trang_thai': 'DA_DONG'})])
def test_admin_routes_forbid_other_roles(support_client, actor, method, suffix, body):
    client, state = support_client
    state['actor'] = actor
    assert client.request(method, BASE + suffix, json=body, headers=ORIGIN).status_code == 403
    assert not state['requests']


def test_customer_only_reads_own_tickets_without_internal_fields(support_client):
    client, state = support_client
    state['actor'] = CUSTOMER
    response = client.get(CUSTOMER_BASE)
    assert response.status_code == 200 and response.json()['total'] == 1
    row = response.json()['data'][0]
    assert not {'ma_kh', 'muc_do_uu_tien', 'nguoi_xu_ly', 'khach'}.intersection(row)
    assert state['requests'][-1].url.params['ma_kh'] == 'eq.KH1'
    assert client.get(CUSTOMER_BASE + '/' + OTHER).status_code == 404
    assert client.get(CUSTOMER_BASE + '/' + TICKET).status_code == 200
    assert state['requests'][-1].url.params['ma_kh'] == 'eq.KH1'
    assert client.get(CUSTOMER_BASE + '?ma_kh=KH2').json()['total'] == 1


@pytest.mark.parametrize('actor', [ADMIN, WAREHOUSE])
def test_customer_routes_reject_non_customer(support_client, actor):
    client, state = support_client
    state['actor'] = actor
    assert client.get(CUSTOMER_BASE).status_code == 403
    assert client.post(CUSTOMER_BASE, headers=ORIGIN, json={'tieu_de': 'Test', 'noi_dung': 'Test'}).status_code == 403
    assert not state['requests']


def test_create_ticket_uses_session_and_one_rpc(support_client):
    client, state = support_client
    state['actor'] = CUSTOMER
    response = client.post(CUSTOMER_BASE, headers=ORIGIN, json={'tieu_de': '  Test  ', 'noi_dung': 'Dòng một\nDòng hai'})
    assert response.status_code == 201
    assert response.json()['tieu_de'] == 'Test'
    assert 'muc_do_uu_tien' not in response.json()
    assert len(state['requests']) == 1
    sent = json.loads(state['requests'][0].content)
    assert sent['p_actor_account_id'] == 'TK1' and 'ma_kh' not in sent['p_payload']


@pytest.mark.parametrize('body', [{'tieu_de': ' ', 'noi_dung': 'x'}, {'tieu_de': 'x', 'noi_dung': ''},
                                  {'tieu_de': 'x', 'noi_dung': 'x', 'ma_kh': 'KH2'},
                                  {'tieu_de': 'x', 'noi_dung': 'x', 'trang_thai': 'DA_DONG'}])
def test_create_validation(support_client, body):
    client, state = support_client
    state['actor'] = CUSTOMER
    assert client.post(CUSTOMER_BASE, headers=ORIGIN, json=body).status_code == 422
    assert not state['requests']


def test_admin_reply_status_and_claim_in_one_rpc(support_client):
    client, state = support_client
    body = {'nhan_xu_ly': True, 'trang_thai': 'DANG_XU_LY', 'muc_do_uu_tien': 'CAO', 'phan_hoi_quan_ly': ' Đã tiếp nhận '}
    response = client.patch(BASE + '/' + TICKET, headers=ORIGIN, json=body)
    assert response.status_code == 200
    assert response.json()['nguoi_xu_ly'] == 'NV1'
    assert response.json()['phan_hoi_quan_ly'] == 'Đã tiếp nhận'
    assert len(state['requests']) == 1
    assert state['requests'][0].url.path.endswith('/rpc/admin_update_feedback_v1')


@pytest.mark.parametrize('body', [{}, {'nhan_xu_ly': False}, {'nhan_xu_ly': 'yes'}, {'trang_thai': None},
                                  {'trang_thai': 'NOPE'}, {'ma_kh': 'KH2'}, {'noi_dung': 'rewrite'}, {'nguoi_xu_ly': 'NV2'}])
def test_patch_validation(support_client, body):
    client, state = support_client
    assert client.patch(BASE + '/' + TICKET, headers=ORIGIN, json=body).status_code == 422
    assert not state['requests']


def test_csrf_and_missing_database(support_client):
    client, state = support_client
    assert client.patch(BASE + '/' + TICKET, json={'trang_thai': 'DA_DONG'}, headers={'Origin': 'https://evil.test'}).status_code == 403
    assert not state['requests']
    state['rpc_error'] = 'PGRST202'
    response = client.patch(BASE + '/' + TICKET, json={'trang_thai': 'DA_DONG'}, headers=ORIGIN)
    assert response.status_code == 503 and '20261023_customer_support.sql' in response.json()['detail']
    assert 'private SQL' not in response.text
