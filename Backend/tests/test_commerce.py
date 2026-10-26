from copy import deepcopy
import json
from uuid import uuid4

import httpx
import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from postgrest import SyncPostgrestClient
from postgrest.exceptions import APIError

from app.commerce.repository import CommerceRepository
from app.commerce.router import get_repository, router
from app.payments.auth import CurrentCustomer, require_customer


@pytest.fixture
def commerce_client(monkeypatch):
    monkeypatch.setenv("CHECKOUT_PROMOTION_TIMEZONE", "Asia/Ho_Chi_Minh")
    quote = {
        "currency": "VND", "tax_application": "invoice", "shipping_status": "not_quoted", "voucher_code": "SAVE10",
        "items": [{"sku": "SKU-A", "warehouse_id": -900002, "name": "Product A", "unit": "Unit", "quantity": 2,
                   "unit_price": "0.10", "gross_total": "0.20", "discount": "0.02", "tax_rate": "10.00", "tax_amount": "0.00", "line_total": "0.18"}],
        "subtotal": "0.20", "discount_total": "0.02", "tax_total": "0.00", "total": "0.18",
    }
    recipient = {"name": "Customer A", "phone": "0901234567", "address_line": "Test address", "province": "Test province", "ward": "Test ward"}
    receipt = {**deepcopy(quote), "id": "ORDER-A", "status": "MOI", "sales_channel": "ONLINE", "created_at": "2026-10-06T00:00:00Z", "recipient": recipient, "note": None}
    detail = {"id": "ORDER-A", "status": "MOI", "created_at": "2026-10-06T00:00:00", "currency": "VND", "total": "0.18", "recipient": recipient, "note": None,
              "items": [{key: value for key, value in receipt["items"][0].items() if key not in {"gross_total", "tax_rate"}}]}
    body = {"recipient": recipient, "note": None, "voucher_code": "save10", "expected_discount": "0.02", "expected_total": "0.18",
            "items": [{"sku": "SKU-A", "warehouse_id": -900002, "quantity": 2, "expected_unit_price": "0.10"}]}
    state = {"quote": quote, "receipt": receipt, "detail": detail, "result": None, "replayed": False, "error": None,
             "profile": [{"ma_kh": "KH-A", "ten_kh": "Customer A", "sdt": "0901234567", "dia_chi_chi_tiet_md": "Test address", "tinh_thanh_md": "Test province", "xa_phuong_md": "Test ward", "mat_khau_hash": "PRIVATE-PASSWORD"}]}
    requests = []

    def handle(request):
        requests.append(request)
        if state["error"]:
            raise state["error"]
        if request.method == "GET":
            assert request.url.path.endswith("/KHACH_HANG")
            return httpx.Response(200, json=state["profile"])
        if request.method == "PATCH":
            assert request.url.path.endswith("/KHACH_HANG")
            if state.get("write_denied"):
                return httpx.Response(200, json=[])
            state["profile"][0].update(json.loads(request.content))
            return httpx.Response(200, json=state["profile"])
        payload = json.loads(request.content)
        if state["result"] is not None:
            return httpx.Response(200, json=state["result"])
        if request.url.path.endswith("/customer_checkout_v2"):
            result = {"order": state["receipt"], "replayed": state["replayed"]} if payload["p_create"] else {"quote": state["quote"]}
        else:
            assert request.url.path.endswith("/customer_read_orders_v2")
            if payload["p_order_id"]:
                result = {"order": state["detail"]}
            else:
                result = {"items": [{key: state["detail"][key] for key in ("id", "status", "created_at", "currency", "total")}], "pagination": {"page": 1, "page_size": 20, "total": 1, "total_pages": 1}}
        return httpx.Response(200, json=result)

    with httpx.Client(transport=httpx.MockTransport(handle)) as transport:
        repository = CommerceRepository(SyncPostgrestClient("https://commerce.test/rest/v1", http_client=transport))
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[get_repository] = lambda: repository
        app.dependency_overrides[require_customer] = lambda: CurrentCustomer(customer_id="KH-A")
        with TestClient(app) as client:
            yield client, state, requests, body, app


@pytest.mark.parametrize("method,path,body", [
    ("GET", "/me", None), ("GET", "/orders", None), ("GET", "/orders/ORDER-A", None),
    ("PUT", "/me", {}),
    ("POST", "/checkout/quote", {"items": [{"sku": "SKU-A", "quantity": 1}]}),
    ("POST", "/orders", {}),
])
def test_all_customer_shopping_endpoints_block_before_db_without_auth(commerce_client, method, path, body):
    client, _, requests, _, app = commerce_client
    app.dependency_overrides.pop(require_customer)
    response = client.request(method, "/api/customer" + path, json=body, headers={"Authorization": "Bearer forged", "X-Customer-Id": "KH-A"})
    assert response.status_code == 503 and response.json()["error"]["code"] == "AUTH_INTEGRATION_REQUIRED"
    assert requests == [] and response.headers["Cache-Control"] == "no-store"


def test_profile_only_reads_verified_customer_and_does_not_expose_hash(commerce_client):
    client, _, requests, _, _ = commerce_client
    response = client.get("/api/customer/me")
    assert response.status_code == 200 and response.json()["customer_id"] == "KH-A"
    assert "PRIVATE" not in response.text
    assert requests[0].url.params["ma_kh"] == 'eq.KH-A'
    assert "*" not in requests[0].url.params["select"] and "mat_khau" not in requests[0].url.params["select"]


def test_quote_rpc_uses_server_identity_canonical_voucher_and_no_create_key(commerce_client):
    client, _, requests, _, _ = commerce_client
    response = client.post("/api/customer/checkout/quote", json={"items": [{"sku": "SKU-A", "quantity": 2}], "voucher_code": " save10 "})
    assert response.status_code == 200 and response.json()["total"] == "0.18"
    assert response.json()["tax_total"] == "0.00" and response.json()["shipping_status"] == "not_quoted"
    assert len(requests) == 1
    payload = json.loads(requests[0].content)
    assert payload["p_customer_id"] == "KH-A" and payload["p_create"] is False and payload["p_key"] is None
    assert payload["p_request"]["voucher_code"] == "SAVE10"
    assert payload["p_promotion_timezone"] == "Asia/Ho_Chi_Minh"


def test_customer_order_creation_and_replay_share_one_rpc(commerce_client):
    client, state, requests, body, _ = commerce_client
    key = str(uuid4())
    response = client.post("/api/customer/orders", json=body, headers={"Idempotency-Key": key})
    assert response.status_code == 201 and response.json()["discount_total"] == "0.02"
    assert response.headers["Idempotency-Replayed"] == "false"
    payload = json.loads(requests[0].content)
    assert payload["p_customer_id"] == "KH-A" and payload["p_create"] is True and payload["p_key"] == key
    assert payload["p_request"]["expected_total"] == "0.18"
    state["replayed"] = True
    replay = client.post("/api/customer/orders", json=body, headers={"Idempotency-Key": key})
    assert replay.status_code == 200 and replay.json() == response.json()
    assert replay.headers["Idempotency-Replayed"] == "true"


@pytest.mark.parametrize("field,value", [("quantity", 0), ("quantity", True), ("quantity", 1.5), ("quantity", "2"), ("quantity", 1001), ("sku", ""), ("sku", "A\x01"), ("sku", "x"*101), ("price", "1.00")])
def test_quote_invalid_or_forged_items_never_reach_db(commerce_client, field, value):
    client, _, requests, _, _ = commerce_client
    item = {"sku": "SKU-A", "quantity": 1, field: value}
    response = client.post("/api/customer/checkout/quote", json={"items": [item]})
    assert response.status_code == 422 and requests == []


@pytest.mark.parametrize("change", ["duplicate", "empty", "too_many", "forged_customer", "long_voucher", "control_voucher"])
def test_quote_validation_and_identity_cannot_be_forged(commerce_client, change):
    client, _, requests, _, _ = commerce_client
    body = {"items": [{"sku": "SKU-A", "quantity": 1}]}
    if change == "duplicate": body["items"] *= 2
    if change == "empty": body["items"] = []
    if change == "too_many": body["items"] = [{"sku": f"SKU-{i}", "quantity": 1} for i in range(101)]
    if change == "forged_customer": body["ma_kh"] = "KH-B"
    if change == "long_voucher": body["voucher_code"] = "X" * 101
    if change == "control_voucher": body["voucher_code"] = "BAD\x00"
    response = client.post("/api/customer/checkout/quote", json=body)
    assert response.status_code == 422 and requests == []


@pytest.mark.parametrize("field,value", [("expected_total", 0.18), ("expected_discount", "0.001"), ("expected_total", "NaN"), ("ma_kh", "KH-B"), ("voucher_id", 1)])
def test_customer_order_request_money_and_unknown_fields(commerce_client, field, value):
    client, _, requests, body, _ = commerce_client
    body[field] = value
    response = client.post("/api/customer/orders", json=body, headers={"Idempotency-Key": str(uuid4())})
    assert response.status_code == 422 and requests == []


@pytest.mark.parametrize("key", [None, "invalid", "00000000-0000-1000-8000-000000000000"])
def test_customer_order_requires_uuid4(commerce_client, key):
    client, _, requests, body, _ = commerce_client
    response = client.post("/api/customer/orders", json=body, headers={} if key is None else {"Idempotency-Key": key})
    assert response.status_code == 422 and requests == []


@pytest.mark.parametrize("code,status", [("VOUCHER_NOT_AVAILABLE", 409), ("VOUCHER_LIMIT_REACHED", 409), ("VOUCHER_MINIMUM_NOT_MET", 409), ("CHECKOUT_CHANGED", 409), ("PRICE_CHANGED", 409), ("INSUFFICIENT_STOCK", 409), ("ORDER_NOT_FOUND", 404), ("AUTH_CUSTOMER_UNAVAILABLE", 403), ("ORDER_CONFIGURATION_REQUIRED", 503)])
def test_domain_errors_use_allowlisted_public_messages(commerce_client, code, status):
    client, state, _, _, _ = commerce_client
    state["result"] = {"error": {"code": code, "message": "PRIVATE", "details": "PRIVATE"}}
    response = client.post("/api/customer/checkout/quote", json={"items": [{"sku": "SKU-A", "quantity": 1}]})
    assert response.status_code == status and response.json()["error"]["code"] == code
    assert "PRIVATE" not in response.text


@pytest.mark.parametrize("change", ["unknown_error", "wrong_total", "wrong_discount", "line_discount", "early_tax", "missing_replay"])
def test_corrupt_checkout_response_never_reports_success(commerce_client, change):
    client, state, _, body, _ = commerce_client
    if change == "unknown_error": state["result"] = {"error": {"code": "PRIVATE-ERROR"}}
    if change == "wrong_total": state["receipt"]["total"] = "0.19"
    if change == "wrong_discount": state["receipt"]["discount_total"] = "0.03"
    if change == "line_discount": state["receipt"]["items"][0]["discount"] = "0.03"
    if change == "early_tax": state["receipt"]["tax_total"] = "0.02"
    if change == "missing_replay": state["result"] = {"order": state["receipt"]}
    response = client.post("/api/customer/orders", json=body, headers={"Idempotency-Key": str(uuid4())})
    assert response.status_code == 500 and "PRIVATE" not in response.text


def test_order_queries_pass_verified_identity_and_accept_legacy_missing_recipient(commerce_client):
    client, state, requests, _, _ = commerce_client
    response = client.get("/api/customer/orders?page=1&page_size=20")
    assert response.status_code == 200
    assert json.loads(requests[-1].content)["p_customer_id"] == "KH-A"
    state["detail"]["recipient"] = {key: None for key in state["detail"]["recipient"]}
    detail = client.get("/api/customer/orders/ORDER-A")
    assert detail.status_code == 200 and detail.json()["recipient"]["phone"] is None
    assert json.loads(requests[-1].content)["p_order_id"] == "ORDER-A"


@pytest.mark.parametrize("query", ["page=0", "page_size=101", "ma_kh=KH-B"])
def test_order_query_validation(commerce_client, query):
    client, _, requests, _, _ = commerce_client
    assert client.get("/api/customer/orders?" + query).status_code == 422 and requests == []


@pytest.mark.parametrize("error,status,code", [
    (httpx.ReadTimeout("PRIVATE"),503,"DATA_SERVICE_UNAVAILABLE"),
    (APIError({"code":"PGRST202","message":"PRIVATE"}),503,"CHECKOUT_DATABASE_NOT_READY"),
    (APIError({"code":"40P01","message":"PRIVATE"}),409,"RETRYABLE_CONFLICT"),
    (RuntimeError("PRIVATE"),500,"INTERNAL_ERROR"),
])
def test_shopping_errors_hide_private_details(commerce_client,error,status,code,caplog):
    client,state,_,_,_=commerce_client
    state["error"]=error
    response=client.post("/api/customer/checkout/quote",json={"items":[{"sku":"SKU-A","quantity":1}]})
    assert response.status_code==status and response.json()["error"]["code"]==code
    assert "PRIVATE" not in response.text and "PRIVATE" not in caplog.text


def test_auth_session_errors_remain_explicit(commerce_client):
    client,_,requests,_,app=commerce_client
    def expired(): raise HTTPException(401,"PRIVATE",headers={"WWW-Authenticate":"Bearer"})
    app.dependency_overrides[require_customer]=expired
    response=client.get("/api/customer/me")
    assert response.status_code==401 and response.json()["error"]["code"]=="AUTHENTICATION_REQUIRED"
    assert response.headers["WWW-Authenticate"]=="Bearer" and requests==[]


def test_swagger_registers_full_customer_shopping_contract(commerce_client):
    client,_,_,_,_=commerce_client
    spec=client.get("/openapi.json").json()
    for path in ("/api/customer/me","/api/customer/checkout/quote","/api/customer/orders","/api/customer/orders/{order_id}"):
        assert path in spec["paths"]
    assert spec["components"]["schemas"]["CustomerOrderRequest"]["additionalProperties"] is False
    operation=spec["paths"]["/api/customer/orders"]["post"]
    assert {"200","201","401","403","404","409","422","500","503"} <= operation["responses"].keys()
    assert spec["paths"]["/api/customer/me"]["put"]["requestBody"]["required"] is True


def test_save_recipient_updates_only_verified_customer_and_shipping_fields(commerce_client):
    client, state, requests, body, _ = commerce_client
    recipient = {**body["recipient"], "name": " New name ", "phone": "090 123-4567"}
    result = client.put("/api/customer/me", json=recipient, headers={"X-Customer-Id": "KH-B"})
    assert result.status_code == 200
    assert result.json()["customer_id"] == "KH-A" and result.json()["name"] == "New name"
    assert result.json()["phone"] == "0901234567"
    assert "PRIVATE-PASSWORD" not in result.text
    write = next(request for request in requests if request.method == "PATCH")
    assert write.url.params["ma_kh"] == "eq.KH-A"
    assert set(json.loads(write.content)) == {"ten_kh", "sdt", "dia_chi_chi_tiet_md", "tinh_thanh_md", "xa_phuong_md"}
    assert state["profile"][0]["mat_khau_hash"] == "PRIVATE-PASSWORD"


@pytest.mark.parametrize("field,value", [("name", " "), ("phone", "abc"), ("address_line", ""),
    ("province", "x"*101), ("ward", "Bad\x00"), ("customer_id", "KH-B"), ("email", "other@example.test")])
def test_save_recipient_invalid_or_account_fields_never_write(commerce_client, field, value):
    client, _, requests, body, _ = commerce_client
    result = client.put("/api/customer/me", json={**body["recipient"], field: value})
    assert result.status_code == 422 and result.json()["error"]["code"] == "VALIDATION_ERROR"
    assert requests == []


def test_save_recipient_rejects_unlinked_identity_before_write(commerce_client):
    client, state, requests, body, _ = commerce_client
    state["profile"] = []
    result = client.put("/api/customer/me", json=body["recipient"])
    assert result.status_code == 403 and all(request.method == "GET" for request in requests)


def test_save_recipient_does_not_claim_success_when_rls_blocks_update(commerce_client):
    client, state, _, body, _ = commerce_client
    state["write_denied"] = True
    result = client.put("/api/customer/me", json=body["recipient"])
    assert result.status_code == 403 and result.json()["error"]["code"] == "PROFILE_UPDATE_DENIED"
