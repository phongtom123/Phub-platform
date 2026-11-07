"""Targeted HTTP/RPC contracts. No live data or schema writes."""
import json
from copy import deepcopy
import httpx
import pytest
from fastapi.testclient import TestClient
from postgrest import SyncPostgrestClient
from phub_api.main import app
from phub_api.config.database import get_supabase
from phub_api.dependencies.auth import current_user
from phub_api.models.user import User

SID="11111111-1111-4111-8111-111111111111"
QID="22222222-2222-4222-8222-222222222222"
OID="33333333-3333-4333-8333-333333333333"
RID="44444444-4444-4444-8444-444444444444"
VERSION="55555555-5555-4555-8555-555555555555"
ADMIN=User("AD1","admin","ADMIN","Admin",employee_id="NV1")
CUSTOMER=User("TK1","customer","KHACH_HANG","Customer",customer_id="KH1")
ORIGIN={"Origin":"http://localhost:3000"}
SURVEY={"ma_khao_sat":SID,"tieu_de":"Survey","mo_ta":"","trang_thai":"NHAP","loai_doi_tuong":"DO_TUOI","tuoi_tu":18,"tuoi_den":24,"han_tra_loi":"2099-01-01T00:00:00Z","phien_ban":VERSION,"ngay_tao":"2026-11-05T00:00:00Z"}
QUESTION={"ma_cau_hoi":QID,"ma_khao_sat":SID,"noi_dung":"Purpose?","loai_cau_hoi":"MOT_LUA_CHON","nhom_noi_dung":"SO_THICH","bat_buoc":True,"thu_tu":1,
    "options":[{"ma_lua_chon":OID,"noi_dung":"Other","cho_phep_nhap_khac":True,"thu_tu":1}]}
DRAFT={"tieu_de":"Survey","mo_ta":"","loai_doi_tuong":"DO_TUOI","tuoi_tu":18,"tuoi_den":24,"han_tra_loi":"2099-01-01T00:00:00Z","questions":[{"noi_dung":"Purpose?","loai_cau_hoi":"MOT_LUA_CHON","nhom_noi_dung":"SO_THICH","bat_buoc":True,"options":[{"noi_dung":"Gaming"},{"noi_dung":"Other","cho_phep_nhap_khac":True}]}]}
REVIEW={"ma_danh_gia":RID,"ma_kh":"KH1","ma_sp":"SP1","ma_donhang":"DH1","so_sao":5,"noi_dung":"Good","trang_thai":"HIEN_THI","phien_ban":VERSION,"ngay_tao":"2026-11-05T00:00:00Z","cap_nhat_luc":"2026-11-05T00:00:00Z"}


@pytest.fixture
def engagement_client(monkeypatch):
    monkeypatch.setenv("FRONTEND_ORIGINS","http://localhost:3000")
    state={"actor":User("AD1","staff","NHAN_VIEN","Staff",employee_id="NV1"),"result":{"survey":deepcopy(SURVEY),"questions":[QUESTION],"recipient":None,"answers":[]},"error":None,"calls":[]}
    def handle(request):
        assert request.method=="POST" and "/rpc/" in request.url.path
        state["calls"].append((request.url.path.split("/")[-1],json.loads(request.content)))
        if state["error"]: return httpx.Response(400,json={"code":state["error"],"message":"private SQL details","details":None,"hint":None})
        return httpx.Response(200,json=state["result"])
    with httpx.Client(transport=httpx.MockTransport(handle)) as transport:
        db=SyncPostgrestClient("https://fixtures.test/rest/v1",http_client=transport)
        app.dependency_overrides[get_supabase]=lambda:db
        app.dependency_overrides[current_user]=lambda:state["actor"]
        try:
            with TestClient(app) as client: yield client,state
        finally: app.dependency_overrides.clear()


def test_admin_draft_and_preview_are_one_scoped_rpc(engagement_client):
    client,state=engagement_client
    response=client.post("/api/crm/surveys",headers=ORIGIN,json={**DRAFT,"request_id":SID})
    assert response.status_code==200 and response.json()["survey"]["ma_khao_sat"]==SID
    name,payload=state["calls"][-1]
    assert name=="crm_survey_write_v1" and payload["p_actor"]=="AD1" and payload["p_id"]==SID and payload["p_action"]=="create"
    assert "request_id" not in payload["p_payload"]
    state["result"]={"data":[{"ma_kh":"KH1","tuoi":20}],"total":1,"page":1,"page_size":20,"phien_ban":VERSION,"is_snapshot":False}
    assert client.get(f"/api/crm/surveys/{SID}/preview").status_code==200
    assert state["calls"][-1][1]["p_admin"] is True


@pytest.mark.parametrize("change",[{"tuoi_tu":-1},{"tuoi_tu":25,"tuoi_den":18},{"tuoi_den":131},{"tuoi_tu":True},{"han_tra_loi":"2099-01-01T12:00:00"},{"ma_kh":"OTHER"}])
def test_invalid_survey_never_reaches_database(engagement_client,change):
    client,state=engagement_client
    assert client.post("/api/crm/surveys",headers=ORIGIN,json={**DRAFT,"request_id":SID,**change}).status_code==422
    assert state["calls"]==[]


def test_customer_submission_uses_session_actor_and_returns_own_snapshot(engagement_client):
    client,state=engagement_client;state["actor"]=CUSTOMER
    state["result"]["recipient"]={"ma_gui":RID,"hoan_thanh_luc":"2026-11-05T01:00:00Z"}
    answer={"ma_cau_hoi":QID,"ma_lua_chon":OID,"noi_dung":"Lập trình"}
    response=client.post(f"/api/customer/crm/surveys/{SID}/submit",headers=ORIGIN,json={"submission_id":RID,"answers":[answer]})
    assert response.status_code==200
    name,payload=state["calls"][-1]
    assert name=="crm_survey_submit_v1" and payload["p_actor"]=="TK1" and payload["p_key"]==RID
    state["calls"].clear()
    assert client.post(f"/api/customer/crm/surveys/{SID}/submit",headers=ORIGIN,json={"submission_id":RID,"answers":[answer,answer]}).status_code==422
    assert state["calls"]==[]


def test_roles_and_origin_are_checked_before_writes(engagement_client):
    client,state=engagement_client
    assert client.post("/api/crm/surveys",headers={"Origin":"https://evil.test"},json={**DRAFT,"request_id":SID}).status_code==403
    state["actor"]=CUSTOMER
    assert client.post("/api/crm/surveys",headers=ORIGIN,json={**DRAFT,"request_id":SID}).status_code==403
    state["actor"]=ADMIN
    assert client.post("/api/customer/crm/reviews",headers=ORIGIN,json={"product_id":"SP1","order_id":"DH1","stars":5,"content":"Good"}).status_code==403
    assert state["calls"]==[]


def test_public_reviews_do_not_require_customer_and_strip_private_fields(engagement_client):
    client,state=engagement_client
    state["result"]={"data":[{"author":"Customer","so_sao":5,"noi_dung":"Good","ngay_tao":"2026-11-05T00:00:00Z","ma_donhang":"PRIVATE"}],"total":1,"page":1,"page_size":20,"average":5,"stars":[{"stars":5,"count":1}]}
    response=client.get("/api/catalog/products/SP1/reviews")
    assert response.status_code==200 and "PRIVATE" not in response.text
    assert state["calls"][-1][1]["p_kind"]=="public" and state["calls"][-1][1]["p_actor"] is None


def test_review_eligibility_filters_product_at_rpc(engagement_client):
    client,state=engagement_client;state["actor"]=CUSTOMER
    state["result"]={"data":[],"total":0,"page":1,"page_size":20}
    assert client.get("/api/customer/crm/reviews/eligible?product_id=SP1").status_code==200
    assert state["calls"][-1][1]["p_product"]=="SP1" and state["calls"][-1][1]["p_actor"]=="TK1"
    assert client.get("/api/customer/crm/reviews/eligible?product_id=").status_code==422


def test_review_mutations_use_versions_and_session_actor(engagement_client):
    client,state=engagement_client;state["actor"]=CUSTOMER;state["result"]=REVIEW
    assert client.post("/api/customer/crm/reviews",headers=ORIGIN,json={"product_id":"SP1","order_id":"DH1","stars":5,"content":"Good"}).status_code==200
    assert state["calls"][-1][1]["p_actor"]=="TK1"
    state["actor"]=User("AD1","staff","NHAN_VIEN","Staff",employee_id="NV1");state["result"]={**REVIEW,"trang_thai":"HIEN_THI"}
    assert client.post(f"/api/crm/reviews/{RID}/moderate",headers=ORIGIN,json={"status":"HIEN_THI","expected_version":VERSION}).status_code==200
    assert state["calls"][-1][1]["p_version"]==VERSION


@pytest.mark.parametrize("code,status",[("42501",403),("P0002",404),("40001",409),("23505",409),("23514",422),("PGRST202",503)])
def test_engagement_errors_never_report_success_or_expose_sql(engagement_client,code,status):
    client,state=engagement_client;state["error"]=code
    response=client.get(f"/api/crm/surveys/{SID}")
    assert response.status_code==status and "private SQL" not in response.text
