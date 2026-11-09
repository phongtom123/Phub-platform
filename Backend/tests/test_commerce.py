from copy import deepcopy
import json
from uuid import uuid4

import httpx
import pytest
from pydantic import ValidationError
from phub_api.schemas.commerce import CustomerOrderRequest, QuoteRequest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from postgrest import SyncPostgrestClient
from postgrest.exceptions import APIError

from phub_api.repositories.commerce import CommerceRepository
from phub_api.dependencies.commerce import get_repository
from phub_api.controllers.commerce import router
from phub_api.models.customer import CurrentCustomer
from phub_api.dependencies.customer import require_customer


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
    address = {"id": "7b0f5f27-1c3b-4f0e-9d7a-3f6f0a1b2c3d", "name": "Customer A", "phone": "0901234567",
               "address_line": "Test address", "province": "Test province", "ward": "Test ward", "is_default": True}
    state = {"address_calls": [], "address_result": {"items": [address], "item": None}, "address": address, "cancel_calls": [],
             "quote": quote, "receipt": receipt, "detail": detail, "result": None, "replayed": False, "error": None,
             "profile": [{"ma_kh": "KH-A", "ten_kh": "Customer A", "sdt": "0901234567", "dia_chi_chi_tiet_md": "Test address", "tinh_thanh_md": "Test province", "xa_phuong_md": "Test ward", "mat_khau": "PRIVATE-PASSWORD"}]}
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
        if request.url.path.endswith("/customer_address_v1"):
            state["address_calls"].append(json.loads(request.content))
            return httpx.Response(200, json=state["address_result"])
        if request.url.path.endswith("/customer_cancel_order_v1"):
            state["cancel_calls"].append(json.loads(request.content))
            return httpx.Response(200, json=state.get("cancel_result", {"order": {**state["detail"], "status": "HUY"}}))
        if request.url.path.endswith('/customer_voucher_choices_v1'):
            return httpx.Response(200, json=state.get('vouchers', {'items': []}))
        payload = json.loads(request.content)
        if state["result"] is not None:
            return httpx.Response(200, json=state["result"])
        if request.url.path.endswith(("/customer_checkout_multi_warehouse_v1", "/customer_checkout_fulfillment_v1")):
            assert request.url.path.endswith("/customer_checkout_fulfillment_v1" if payload["p_create"] else "/customer_checkout_multi_warehouse_v1")
            result = {"order": state["receipt"], "replayed": state["replayed"]} if payload["p_create"] else {"quote": state["quote"]}
        else:
            assert request.url.path.endswith("/customer_read_orders_v4")
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
    ("GET", "/addresses", None), ("POST", "/addresses", {}),
    ('GET', '/vouchers', None),
    ("PUT", "/addresses/7b0f5f27-1c3b-4f0e-9d7a-3f6f0a1b2c3d", {}),
    ("POST", "/addresses/7b0f5f27-1c3b-4f0e-9d7a-3f6f0a1b2c3d/delete", None),
    ("POST", "/checkout/quote", {"items": [{"sku": "SKU-A", "quantity": 1}]}),
    ("POST", "/orders", {}),
])
def test_all_customer_shopping_endpoints_block_before_db_without_auth(commerce_client, method, path, body):
    client, _, requests, _, app = commerce_client
    app.dependency_overrides.pop(require_customer)
    response = client.request(method, "/api/customer" + path, json=body, headers={"Authorization": "Bearer forged", "X-Customer-Id": "KH-A"})
    assert response.status_code == 401 and response.json()["error"]["code"] == "AUTHENTICATION_REQUIRED"
    assert requests == [] and response.headers["Cache-Control"] == "no-store"


def test_profile_only_reads_verified_customer_and_does_not_expose_hash(commerce_client):
    client, _, requests, _, _ = commerce_client
    response = client.get("/api/customer/me")
    assert response.status_code == 200 and response.json()["customer_id"] == "KH-A"
    assert "PRIVATE" not in response.text
    assert requests[0].url.params["ma_kh"] == 'eq.KH-A'
    assert "*" not in requests[0].url.params["select"] and "mat_khau" not in requests[0].url.params["select"]


def test_profile_returns_linked_account_avatar(commerce_client):
    client, state, _, _, _ = commerce_client
    state["profile"][0]["account"] = {"avatar": {"url": "https://example.test/avatar.webp"}}
    response = client.get("/api/customer/me")
    assert response.status_code == 200
    assert response.json()["avatar_url"] == "https://example.test/avatar.webp"


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


def test_voucher_choices_use_verified_customer_and_never_create_order(commerce_client):
    client, state, requests, _, _ = commerce_client
    state['vouchers'] = {'items': [{
        'code': 'SAVE10', 'discount_type': 'PHAN_TRAM', 'discount_value': '10.00',
        'minimum_order': '100.00', 'maximum_discount': '500.00',
        'starts_at': '2026-11-01T00:00:00+07:00', 'expires_at': '2026-11-30T23:59:59+07:00',
        'unavailable_reason': None,
    }]}
    response = client.get('/api/customer/vouchers')
    assert response.status_code == 200
    assert response.json() == {**state['vouchers'], 'currency': 'VND'}
    assert len(requests) == 1
    assert json.loads(requests[0].content) == {'p_customer_id': 'KH-A', 'p_timezone': 'Asia/Ho_Chi_Minh'}
    assert client.get('/api/customer/vouchers?customer_id=KH-B').status_code == 422


@pytest.mark.parametrize('reason,message', [('EXPIRED', 'đã hết hạn'), ('NOT_STARTED', 'chưa bắt đầu')])
def test_voucher_quote_explains_active_code_outside_campaign_dates(commerce_client, reason, message):
    client, state, _, _, _ = commerce_client
    state['result'] = {'error': {'code': 'VOUCHER_NOT_AVAILABLE'}}
    state['vouchers'] = {'items': [{'code': 'SAVE10', 'discount_type': 'PHAN_TRAM', 'discount_value': '10.00',
        'minimum_order': '100.00', 'maximum_discount': None, 'starts_at': '2026-11-01T00:00:00Z',
        'expires_at': '2026-11-30T00:00:00Z', 'unavailable_reason': reason}]}
    response = client.post('/api/customer/checkout/quote', json={'items': [{'sku': 'SKU-A', 'quantity': 1}], 'voucher_code': ' save10 '})
    assert response.status_code == 409 and message in response.json()['error']['message']


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


def test_pooled_quote_retains_one_product_with_all_warehouse_allocations(commerce_client):
    client, state, requests, _, _ = commerce_client
    allocations = [{"warehouse_id": -900002, "quantity": 1}, {"warehouse_id": 3, "quantity": 1}]
    state["quote"]["items"][0]["allocations"] = allocations
    response = client.post("/api/customer/checkout/quote", json={"items": [{"sku": "SKU-A", "quantity": 2}]})
    assert response.status_code == 200
    assert len(response.json()["items"]) == 1
    assert response.json()["items"][0]["allocations"] == allocations
    assert requests[0].url.path.endswith("/customer_checkout_multi_warehouse_v1")


def test_pickup_needs_only_contact_and_is_preserved_in_receipt(commerce_client):
    client, state, requests, body, _ = commerce_client
    contact = {"name": "Pickup Customer", "phone": "+84 901 234 567"}
    request = {**body, "fulfillment_method": "TAI_CUA_HANG", "recipient": contact}
    state["receipt"] = {**state["receipt"], "fulfillment_method": "TAI_CUA_HANG",
                        "recipient": {"name": contact["name"], "phone": "+84901234567"}}
    response = client.post("/api/customer/orders", json=request, headers={"Idempotency-Key": str(uuid4())})
    assert response.status_code == 201
    assert response.json()["fulfillment_method"] == "TAI_CUA_HANG"
    assert response.json()["recipient"]["address_line"] is None
    sent = json.loads(requests[0].content)["p_request"]
    assert sent["fulfillment_method"] == "TAI_CUA_HANG"
    assert sent["recipient"] == {"name": contact["name"], "phone": "+84901234567"}


@pytest.mark.parametrize("method,recipient", [
    ("OTHER", {"name": "Test", "phone": "0901234567"}),
    ("GIAO_HANG", {"name": "Test", "phone": "0901234567"}),
    ("TAI_CUA_HANG", {"name": "", "phone": "0901234567"}),
    ("TAI_CUA_HANG", {"name": "Test", "phone": "bad"}),
    ("TAI_CUA_HANG", {"name": "Test", "phone": "0901234567", "address_line": "Forged", "province": "P", "ward": "W"}),
])
def test_fulfillment_validation_precedes_database(commerce_client, method, recipient):
    client, _, requests, body, _ = commerce_client
    response = client.post("/api/customer/orders", json={**body, "fulfillment_method": method, "recipient": recipient},
                           headers={"Idempotency-Key": str(uuid4())})
    assert response.status_code == 422 and requests == []


@pytest.mark.parametrize("allocations", [
    [{"warehouse_id": -900002, "quantity": 1}],
    [{"warehouse_id": -900002, "quantity": 1}, {"warehouse_id": -900002, "quantity": 1}],
    [{"warehouse_id": 3, "quantity": 2}],
    [{"warehouse_id": -900002, "quantity": 0}],
])
def test_corrupt_warehouse_allocation_is_rejected(commerce_client, allocations):
    client, state, _, _, _ = commerce_client
    state["quote"]["items"][0]["allocations"] = allocations
    response = client.post("/api/customer/checkout/quote", json={"items": [{"sku": "SKU-A", "quantity": 2}]})
    assert response.status_code == 500


@pytest.mark.parametrize("field,value", [("quantity", 0), ("quantity", True), ("quantity", 1.5), ("quantity", "2"), ("quantity", 2147483648), ("sku", ""), ("sku", "A\x01"), ("sku", "x"*101), ("price", "1.00")])
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
    assert state["profile"][0]["mat_khau"] == "PRIVATE-PASSWORD"


def test_profile_birthday_round_trip_and_omission_preserves_existing(commerce_client):
    client, state, requests, body, _ = commerce_client
    state["profile"][0]["ngay_sinh"] = "2000-02-29"
    response = client.get("/api/customer/me")
    assert response.status_code == 200 and response.json()["birthday"] == "2000-02-29"
    response = client.put("/api/customer/me", json=body["recipient"])
    assert response.status_code == 200 and response.json()["birthday"] == "2000-02-29"
    assert "ngay_sinh" not in json.loads(next(request for request in requests if request.method == "PATCH").content)
    response = client.put("/api/customer/me", json={**body["recipient"], "birthday": "1999-11-05"})
    assert response.status_code == 200 and response.json()["birthday"] == "1999-11-05"
    response = client.put("/api/customer/me", json={**body["recipient"], "birthday": None})
    assert response.status_code == 200 and response.json()["birthday"] is None


@pytest.mark.parametrize("birthday", ["2999-01-01", "2001-02-29", 1000, ""])
def test_invalid_customer_birthday_never_writes(commerce_client, birthday):
    client, _, requests, body, _ = commerce_client
    assert client.put("/api/customer/me", json={**body["recipient"], "birthday": birthday}).status_code == 422
    assert requests == []


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


def test_checkout_accepts_stock_over_1000_and_distinct_warehouse_allocations(commerce_client):
    _, _, _, body, _ = commerce_client
    assert QuoteRequest(items=[{'sku': 'A', 'quantity': 1301}]).items[0].quantity == 1301
    body['items'] += [{**body['items'][0], 'warehouse_id': 2, 'quantity': 1301}]
    request = CustomerOrderRequest.model_validate(body)
    assert len(request.items) == 2
    duplicate = deepcopy(body)
    duplicate['items'].append(deepcopy(duplicate['items'][0]))
    with pytest.raises(ValidationError):
        CustomerOrderRequest.model_validate(duplicate)
ADDRESS_ID = "7b0f5f27-1c3b-4f0e-9d7a-3f6f0a1b2c3d"


def test_address_book_list_uses_verified_customer_and_rpc_only(commerce_client):
    client, state, requests, _, _ = commerce_client
    response = client.get("/api/customer/addresses", headers={"X-Customer-Id": "KH-B"})
    assert response.status_code == 200 and response.json() == {"items": [state["address"]], "item": None}
    assert response.headers["Cache-Control"] == "no-store"
    assert state["address_calls"] == [{"p_customer_id": "KH-A", "p_action": "list", "p_address_id": None, "p_payload": None}]
    assert [request.url.path.rsplit("/", 1)[-1] for request in requests] == ["customer_address_v1"]


def test_address_create_normalizes_input_and_never_sends_a_customer_id(commerce_client):
    client, state, _, body, _ = commerce_client
    state["address_result"] = {"items": [state["address"]], "item": state["address"]}
    payload = {**body["recipient"], "name": " Moi ", "phone": "090 123-4567", "is_default": True}
    response = client.post("/api/customer/addresses", json=payload, headers={"X-Customer-Id": "KH-B"})
    assert response.status_code == 201 and response.json()["item"]["id"] == ADDRESS_ID
    call = state["address_calls"][0]
    assert call["p_customer_id"] == "KH-A" and call["p_action"] == "create" and call["p_address_id"] is None
    assert call["p_payload"] == {**body["recipient"], "name": "Moi", "phone": "0901234567", "is_default": True}


def test_address_update_and_delete_use_the_path_id(commerce_client):
    client, state, _, body, _ = commerce_client
    state["address_result"] = {"items": [state["address"]], "item": state["address"]}
    assert client.put(f"/api/customer/addresses/{ADDRESS_ID}", json=body["recipient"]).status_code == 200
    state["address_result"] = {"items": [], "item": None}
    response = client.post(f"/api/customer/addresses/{ADDRESS_ID}/delete")
    assert response.status_code == 200 and response.json() == {"items": [], "item": None}
    update, delete = state["address_calls"]
    assert (update["p_action"], update["p_address_id"], update["p_payload"]["is_default"]) == ("update", ADDRESS_ID, False)
    assert (delete["p_action"], delete["p_address_id"], delete["p_payload"]) == ("delete", ADDRESS_ID, None)


@pytest.mark.parametrize("field,value", [
    ("name", " "), ("phone", "abc"), ("address_line", ""), ("province", "x" * 101), ("ward", "Bad\x00"),
    ("is_default", "true"), ("ma_kh", "KH-B"), ("customer_id", "KH-B"), ("id", ADDRESS_ID),
])
def test_address_invalid_or_foreign_fields_never_reach_the_database(commerce_client, field, value):
    client, state, requests, body, _ = commerce_client
    response = client.post("/api/customer/addresses", json={**body["recipient"], field: value})
    assert response.status_code == 422 and response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert requests == [] and state["address_calls"] == []


@pytest.mark.parametrize("method,path", [
    ("PUT", "/api/customer/addresses/not-a-uuid"), ("POST", "/api/customer/addresses/not-a-uuid/delete"),
    ("POST", f"/api/customer/addresses/{ADDRESS_ID}/delete?ma_kh=KH-B"), ("GET", "/api/customer/addresses?ma_kh=KH-B"),
])
def test_address_bad_path_or_query_is_rejected_before_the_database(commerce_client, method, path):
    client, _, requests, body, _ = commerce_client
    response = client.request(method, path, json=body["recipient"] if method == "PUT" else None)
    assert response.status_code == 422 and requests == []


@pytest.mark.parametrize("code,status", [
    ("ADDRESS_NOT_FOUND", 404), ("ADDRESS_LIMIT_REACHED", 409), ("AUTH_CUSTOMER_UNAVAILABLE", 403), ("VALIDATION_ERROR", 422),
])
def test_address_rpc_errors_map_to_safe_http_errors(commerce_client, code, status):
    client, state, _, body, _ = commerce_client
    state["address_result"] = {"error": {"code": code}}
    response = client.put(f"/api/customer/addresses/{ADDRESS_ID}", json=body["recipient"])
    assert response.status_code == status and response.json()["error"]["code"] == code


def test_address_unknown_rpc_error_or_missing_migration_is_hidden(commerce_client):
    client, state, _, _, _ = commerce_client
    state["address_result"] = {"error": {"code": "PRIVATE_SQL_STATE"}}
    response = client.get("/api/customer/addresses")
    assert response.status_code == 500 and "PRIVATE" not in response.text
    state["error"] = APIError({"code": "PGRST202", "message": "PRIVATE"})
    response = client.get("/api/customer/addresses")
    assert response.status_code == 503 and response.json()["error"]["code"] == "CHECKOUT_DATABASE_NOT_READY"
    assert "PRIVATE" not in response.text


def test_swagger_registers_the_address_book_contract(commerce_client):
    client, _, _, _, _ = commerce_client
    spec = client.get("/openapi.json").json()
    assert spec["paths"]["/api/customer/addresses"].keys() >= {"get", "post"}
    assert spec["paths"]["/api/customer/addresses/{address_id}"].keys() >= {"put"}
    assert spec["paths"]["/api/customer/addresses/{address_id}/delete"].keys() >= {"post"}
    assert spec["components"]["schemas"]["AddressRequest"]["additionalProperties"] is False
    assert {"201", "401", "403", "409", "422", "503"} <= spec["paths"]["/api/customer/addresses"]["post"]["responses"].keys()


def test_cancel_order_calls_rpc_with_customer_and_order_id(commerce_client):
    client, state, _, _, _ = commerce_client
    response = client.post("/api/customer/orders/ORDER-A/cancel")
    assert response.status_code == 200
    assert response.json()["status"] == "HUY"
    assert len(state["cancel_calls"]) == 1
    assert state["cancel_calls"][0] == {"p_customer_id": "KH-A", "p_order_id": "ORDER-A", "p_reason": None}


def test_cancel_order_with_reason(commerce_client):
    client, state, _, _, _ = commerce_client
    response = client.post("/api/customer/orders/ORDER-A/cancel", json={"reason": "Doi y khong mua nua"})
    assert response.status_code == 200
    assert state["cancel_calls"][0]["p_reason"] == "Doi y khong mua nua"


@pytest.mark.parametrize("code,status", [
    ("ORDER_NOT_FOUND", 404),
    ("ORDER_ALREADY_CANCELLED", 409),
    ("ORDER_NOT_CANCELABLE", 409),
    ("ORDER_REFUND_REQUIRED", 409),
    ("AUTH_CUSTOMER_UNAVAILABLE", 403),
])
def test_cancel_order_errors_map_safely(commerce_client, code, status):
    client, state, _, _, _ = commerce_client
    state["cancel_result"] = {"error": {"code": code}}
    response = client.post("/api/customer/orders/ORDER-A/cancel")
    assert response.status_code == status and response.json()["error"]["code"] == code


def test_cancel_order_contract_in_swagger(commerce_client):
    client, _, _, _, _ = commerce_client
    spec = client.get("/openapi.json").json()
    assert spec["paths"]["/api/customer/orders/{order_id}/cancel"].keys() >= {"post"}
    assert {"200", "401", "403", "404", "409", "422", "503"} <= spec["paths"]["/api/customer/orders/{order_id}/cancel"]["post"]["responses"].keys()
