"""Only mocked HTTP/RPC contracts: no hosted data writes."""
from test_engagement import engagement_client, ADMIN, CUSTOMER, VERSION, ORIGIN
from phub_api.models.user import User

TICKET='11111111-1111-4111-8111-111111111111'
KEY='22222222-2222-4222-8222-222222222222'
STAFF=User('STAFF','staff','NHAN_VIEN','Staff',employee_id='NV2',warehouse_id=1)
HEADERS={**ORIGIN,'Idempotency-Key':KEY}
DECISION={'action':'approve','expected_version':VERSION,'verification_note':'Checked original invoice with customer','verified':True,'invoice_version':'a'*64}


def test_customer_claim_is_session_scoped_and_hides_internal_audit(engagement_client):
    client,state=engagement_client
    state['actor']=CUSTOMER
    state['result']={'ma_phan_hoi':TICKET,'tieu_de':'Link invoice','noi_dung':'Bought at store','trang_thai':'MOI',
        'ngay_tao':'2026-11-06T00:00:00Z','cap_nhat_luc':'2026-11-06T00:00:00Z',
        'loai_yeu_cau':'LIEN_KET_HOA_DON','ma_hoa_don_yeu_cau':'HD-1','ghi_chu_xac_minh':'internal','tai_khoan_xac_minh':'AD1'}
    response=client.post('/api/customer/crm/invoice-claims',headers=HEADERS,json={'invoice_id':' HD-1 ','evidence':'Original store purchase'})
    assert response.status_code==201
    assert 'ghi_chu_xac_minh' not in response.json() and 'tai_khoan_xac_minh' not in response.json()
    name,args=state['calls'][-1]
    assert name=='customer_invoice_claim_v1' and args=={'p_actor':'TK1','p_key':KEY,'p_invoice':'HD-1','p_evidence':'Original store purchase'}
    state['calls'].clear()
    assert client.post('/api/customer/crm/invoice-claims',headers=HEADERS,json={'invoice_id':'HD-1','evidence':'Original store purchase','ma_kh':'OTHER'}).status_code==422
    assert not state['calls']


def test_claim_roles_origin_and_required_proof(engagement_client):
    client,state=engagement_client
    state['actor']=CUSTOMER
    assert client.get('/api/staff/invoice-claims').status_code==403
    assert client.post(f'/api/staff/invoice-claims/{TICKET}/decision',headers=HEADERS,json=DECISION).status_code==403
    state['actor']=STAFF
    assert client.get('/api/staff/invoice-claims').status_code==200
    state['calls'].clear()
    for body in [{**DECISION,'verified':False},{**DECISION,'verified':'true'},{**DECISION,'invoice_version':None},{**DECISION,'verification_note':'x'},{**DECISION,'ma_kh':'OTHER'}]:
        assert client.post(f'/api/staff/invoice-claims/{TICKET}/decision',headers=HEADERS,json=body).status_code==422
    assert client.post(f'/api/staff/invoice-claims/{TICKET}/decision',headers={**HEADERS,'Origin':'https://evil.test'},json=DECISION).status_code==403
    assert not state['calls']
    assert client.post('/api/customer/crm/invoice-claims',headers=HEADERS,json={'invoice_id':'HD-1','evidence':'Original store purchase'}).status_code==403


def test_staff_approval_and_backend_failure_never_report_success(engagement_client):
    client,state=engagement_client;state['actor']=STAFF
    response=client.post(f'/api/staff/invoice-claims/{TICKET}/decision',headers=HEADERS,json=DECISION)
    assert response.status_code==200 and response.headers['cache-control']=='no-store'
    name,args=state['calls'][-1]
    assert name=='staff_invoice_claim_decide_v1' and args['p_actor']=='STAFF' and args['p_version']==VERSION and args['p_key']==KEY and args['p_verified'] is True
    state['error']='40001'
    assert client.post(f'/api/staff/invoice-claims/{TICKET}/decision',headers=HEADERS,json=DECISION).status_code==409
    state['error']='PGRST202'
    assert client.get('/api/staff/invoice-claims').status_code==503


def test_staff_counter_order_uses_existing_transaction_and_requires_key(engagement_client):
    client,state=engagement_client;state['actor']=STAFF
    body={'customer_id':'KH1','recipient':'Customer 1','buyer_email':'customer@example.com','lines':[{'sku':'SKU1','warehouse_id':1,'unit_price':'100.00','quantity':1}]}
    assert client.post('/api/staff/counter/orders',headers=HEADERS,json=body).status_code==201
    name,args=state['calls'][-1]
    assert name=='staff_counter_order_email_v1' and args['p_actor']=='STAFF'
    assert args['p_body']['lines'][0]['unit_price']=='100.00'
    state['calls'].clear()
    assert client.post('/api/staff/counter/orders',headers=ORIGIN,json=body).status_code==422
    assert client.post('/api/staff/counter/orders',headers=HEADERS,json={**body,'action':'complete'}).status_code==422
    assert not state['calls']
    state['actor']=CUSTOMER
    assert client.get('/api/staff/counter/customers').status_code==403
    assert client.post('/api/staff/counter/orders',headers=HEADERS,json=body).status_code==403
