"""Buyer identity and email persistence contract; all database calls are mocked."""
import json
from uuid import uuid4
import httpx
import pytest
from postgrest import SyncPostgrestClient
from fastapi.testclient import TestClient
from phub_api.main import app
from phub_api.config.database import get_supabase
from phub_api.dependencies.auth import current_user
from phub_api.models.user import User


@pytest.fixture
def counter_client(monkeypatch):
    monkeypatch.setenv('FRONTEND_ORIGINS','http://localhost:3002')
    state={'calls':[], 'missing_email_column':False, 'missing_counter_rpc':False}
    def handle(request):
        state['calls'].append(request)
        if state['missing_counter_rpc'] and request.method=='POST':
            return httpx.Response(404,json={'code':'PGRST202','message':'Counter RPC not installed','details':None,'hint':None})
        if request.method=='GET':
            if state['missing_email_column'] and 'email_nguoi_mua' in str(request.url):
                return httpx.Response(400,json={'code':'42703','message':'column DON_HANG.email_nguoi_mua does not exist','details':None,'hint':None})
            return httpx.Response(200,json=[{'ma_donhang':'OLD','trang_thai':'MOI'}],headers={'content-range':'0-0/1'})
        if request.url.path.endswith('/staff_counter_customer_email_v1'):
            return httpx.Response(200,json={'data':[{'ma_kh':'KH1','ten_kh':'Customer','sdt':None,'email':'customer@example.com','ten_tai_khoan':'customer'}]})
        return httpx.Response(200,json={'data':[{'ma_donhang':'DH1','email_nguoi_mua':'customer@example.com'}],'replayed':False})
    with httpx.Client(transport=httpx.MockTransport(handle)) as transport:
        db=SyncPostgrestClient('https://fixture.test/rest/v1',http_client=transport)
        app.dependency_overrides[current_user]=lambda: User('STAFF','staff','NHAN_VIEN','Staff',employee_id='NV1')
        app.dependency_overrides[get_supabase]=lambda:db
        try:
            with TestClient(app) as client: yield client,state
        finally: app.dependency_overrides.clear()


def order_body(**changes):
    return {'recipient':'Customer','buyer_email':'  CUSTOMER@example.com  ',
        'lines':[{'sku':'S','warehouse_id':1,'unit_price':'100.00','quantity':1}],**changes}


def test_customer_lookup_is_exact_normalized_email(counter_client):
    client,state=counter_client
    response=client.get('/api/staff/counter/customers',params={'email':' CUSTOMER@example.com '})
    assert response.status_code==200 and response.json()['data'][0]['ma_kh']=='KH1'
    request=state['calls'][0]
    assert request.url.path.endswith('/rpc/staff_counter_customer_email_v1')
    assert json.loads(request.content)=={'p_actor':'STAFF','p_email':'customer@example.com'}


@pytest.mark.parametrize('email',['','not-an-email','a@b','a b@example.com'])
def test_invalid_email_never_queries_database(counter_client,email):
    client,state=counter_client
    assert client.get('/api/staff/counter/customers',params={'email':email}).status_code==422
    assert not state['calls']


@pytest.mark.parametrize('member',[True,False])
@pytest.mark.parametrize('route',['/api/staff/counter/orders','/api/admin/operations/orders'])
def test_both_entrypoints_pass_email_and_explicit_ownership_to_same_transaction(counter_client,member,route):
    client,state=counter_client
    body=order_body(**({'customer_id':'KH1'} if member else {}))
    if '/admin/' in route: body={'action':'create','data':body}
    response=client.post(route,json=body,headers={'Origin':'http://localhost:3002','Idempotency-Key':str(uuid4())})
    assert response.status_code in {200,201}
    request=state['calls'][0]
    assert request.url.path.endswith('/rpc/staff_counter_order_email_v1')
    payload=json.loads(request.content)['p_body']
    assert payload['buyer_email']=='customer@example.com'
    assert payload.get('customer_id')==('KH1' if member else None)


@pytest.mark.parametrize('route',['/api/staff/counter/orders','/api/admin/operations/orders'])
def test_email_is_required_before_any_write(counter_client,route):
    client,state=counter_client
    body=order_body();del body['buyer_email']
    if '/admin/' in route: body={'action':'create','data':body}
    assert client.post(route,json=body,headers={'Origin':'http://localhost:3002','Idempotency-Key':str(uuid4())}).status_code==422
    assert not state['calls']


@pytest.mark.parametrize('route',['/api/staff/counter/orders','/api/admin/operations/orders'])
def test_missing_migration_never_falls_back_to_order_without_email(counter_client,route):
    client,state=counter_client;state['missing_counter_rpc']=True
    body=order_body()
    if '/admin/' in route: body={'action':'create','data':body}
    response=client.post(route,json=body,headers={'Origin':'http://localhost:3002','Idempotency-Key':str(uuid4())})
    assert response.status_code==503
    assert len(state['calls'])==1
    assert state['calls'][0].url.path.endswith('/rpc/staff_counter_order_email_v1')


@pytest.mark.parametrize('params',[{}, {'q':'OLD'}, {'key':'["OLD"]'}])
def test_old_order_reads_survive_pending_email_migration(counter_client,params):
    client,state=counter_client;state['missing_email_column']=True
    response=client.get('/api/data/orders',params=params)
    assert response.status_code==200
    assert response.json()['data'][0]['email_nguoi_mua'] is None
    assert len(state['calls'])==2
    assert 'email_nguoi_mua' not in str(state['calls'][1].url)
