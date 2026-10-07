from copy import deepcopy
from decimal import Decimal
from uuid import uuid4

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from postgrest import SyncPostgrestClient
from postgrest.exceptions import APIError

from app.orders.repository import OrderRepository
from app.orders.router import get_repository, router
from app.orders.schemas import CreateOrder
from app.orders.settings import OrderSettings
from app.payments.auth import CurrentCustomer, require_customer


@pytest.fixture
def order_body():
    return {
        "recipient": {"name": "Khách thử nghiệm", "phone": "0901234567", "address_line": "Địa chỉ thử nghiệm", "province": "TP Hồ Chí Minh", "ward": "Phường thử nghiệm"},
        "items": [{"sku": "SKU-A", "warehouse_id": -900001, "quantity": 2, "expected_unit_price": "0.10"}],
        "note": None,
    }


@pytest.fixture
def orders_client(order_body):
    receipt = {
        "id": str(uuid4()), "status": "MOI", "sales_channel": "ONLINE",
        "created_at": "2026-10-04T00:00:00Z", "currency": "VND", "tax_application": "invoice",
        "recipient": deepcopy(order_body["recipient"]), "note": None,
        "items": [{"sku": "SKU-A", "warehouse_id": -900001, "name": "Tên lúc bán", "unit": "Cái", "quantity": 2, "unit_price": "0.10", "tax_rate": "10.00", "tax_amount": "0.00", "line_total": "0.20"}],
        "subtotal": "0.20", "tax_total": "0.00", "total": "0.20",
    }
    state = {"result": {"replayed": False, "order": receipt}, "error": None}
    requests = []

    def handle(request):
        requests.append(request)
        if state["error"]:
            raise state["error"]
        return httpx.Response(200, json=state["result"])

    with httpx.Client(transport=httpx.MockTransport(handle)) as transport:
        repository = OrderRepository(SyncPostgrestClient("https://orders.test/rest/v1", http_client=transport), OrderSettings("reserve_on_order", "exclusive", Decimal("10"), "VND", 1))
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[get_repository] = lambda: repository
        app.dependency_overrides[require_customer] = lambda: CurrentCustomer(customer_id="KH-ORDERS")
        with TestClient(app) as client:
            yield client, state, requests, repository


def post(client, body, key=None):
    return client.post("/api/orders", json=body, headers={"Idempotency-Key": key or str(uuid4())})


def test_create_uses_one_atomic_rpc_and_preserves_exact_money(orders_client, order_body):
    client, state, requests, _ = orders_client
    key = str(uuid4())
    response = post(client, order_body, key)
    assert response.status_code == 201
    assert response.json()["total"] == "0.20"
    assert response.json()["tax_total"] == "0.00"
    assert response.json()["items"][0]["tax_rate"] == "10.00"
    assert response.json()["items"][0]["name"] == "Tên lúc bán"
    assert response.headers["Idempotency-Replayed"] == "false"
    assert response.headers["Cache-Control"] == "no-store"
    assert len(requests) == 1
    request = requests[0]
    assert request.method == "POST" and request.url.path == "/rest/v1/rpc/customer_checkout_v2"
    import json
    payload = json.loads(request.content)
    assert payload == {"p_key": key, "p_request": {**order_body, "voucher_code": None, "expected_discount": "0.00", "expected_total": "0.20"}, "p_stock_policy": "reserve_on_order", "p_price_tax_mode": "exclusive", "p_tax_rate": "10.00", "p_currency": "VND", "p_active_status": 1, "p_tax_application": "invoice", "p_customer_id": "KH-ORDERS", "p_create": True, "p_promotion_timezone": "Asia/Ho_Chi_Minh"}


def test_replay_returns_original_receipt_with_200(orders_client, order_body):
    client, state, _, _ = orders_client
    first = post(client, order_body)
    state["result"]["replayed"] = True
    repeated = post(client, order_body)
    assert repeated.status_code == 200 and repeated.json() == first.json()
    assert repeated.headers["Idempotency-Replayed"] == "true"


def test_existing_order_endpoint_cannot_bypass_customer_auth(orders_client, order_body):
    client, _, requests, _ = orders_client
    client.app.dependency_overrides.pop(require_customer)
    response = post(client, order_body)
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "AUTH_INTEGRATION_REQUIRED"
    assert requests == [] and response.headers["Cache-Control"] == "no-store"


@pytest.mark.parametrize("field,value", [
    ("quantity", 0), ("quantity", -1), ("quantity", 1.5), ("quantity", True), ("quantity", "2"), ("quantity", 1001),
    ("warehouse_id", True), ("warehouse_id", "1"), ("warehouse_id", 2147483648),
    ("sku", ""), ("sku", "x" * 101), ("sku", "A\x00"),
    ("expected_unit_price", 0.1), ("expected_unit_price", "-1"), ("expected_unit_price", "0.001"),
    ("expected_unit_price", "NaN"), ("expected_unit_price", "Infinity"), ("expected_unit_price", "1e2"),
    ("expected_unit_price", "10000000000000000"), ("unknown_price", "0.10"),
])
def test_invalid_line_is_422_without_rpc(orders_client, order_body, field, value):
    client, _, requests, _ = orders_client
    order_body["items"][0][field] = value
    response = post(client, order_body)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert response.json()["error"]["details"] and requests == []


@pytest.mark.parametrize("field,value", [
    ("name", "   "), ("name", "x" * 101), ("phone", "abc"), ("phone", "123"),
    ("address_line", ""), ("address_line", "x" * 256), ("province", ""), ("ward", "\x01"),
])
def test_invalid_recipient_is_422_without_rpc(orders_client, order_body, field, value):
    client, _, requests, _ = orders_client
    order_body["recipient"][field] = value
    response = post(client, order_body)
    assert response.status_code == 422 and requests == []
    assert set(response.json()["error"]) == {"code", "message", "details"}


@pytest.mark.parametrize("mutation", ["empty", "duplicate", "too_many", "forged_total", "forged_customer", "long_note"])
def test_invalid_order_is_422_without_rpc(orders_client, order_body, mutation):
    client, _, requests, _ = orders_client
    if mutation == "empty": order_body["items"] = []
    if mutation == "duplicate": order_body["items"].append(deepcopy(order_body["items"][0]))
    if mutation == "too_many": order_body["items"] *= 101
    if mutation == "forged_total": order_body["total"] = "0.01"
    if mutation == "forged_customer": order_body["ma_kh"] = "someone-else"
    if mutation == "long_note": order_body["note"] = "x" * 2001
    assert post(client, order_body).status_code == 422 and requests == []


@pytest.mark.parametrize("key", ["bad", "1" * 36, "00000000-0000-1000-8000-000000000000", "00000000-0000-0000-0000-000000000000"])
def test_invalid_key_does_not_call_rpc(orders_client, order_body, key):
    client, _, requests, _ = orders_client
    assert post(client, order_body, key).status_code == 422 and requests == []


def test_missing_key_and_malformed_json_are_normalized(orders_client, order_body):
    client, _, requests, _ = orders_client
    for response in [client.post("/api/orders", json=order_body), client.post("/api/orders", content="{", headers={"Content-Type": "application/json", "Idempotency-Key": str(uuid4())})]:
        assert response.status_code == 422 and response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert requests == []


def test_canonical_request_normalizes_order_phone_prices_and_blank_note(order_body):
    other = {"sku": "SKU-B", "warehouse_id": 1, "quantity": 1, "expected_unit_price": "1"}
    order_body["items"].append(other)
    first = CreateOrder.model_validate(order_body).canonical_payload()
    order_body["items"].reverse()
    order_body["items"][0]["expected_unit_price"] = "1.00"
    order_body["recipient"]["name"] = " Khách thử nghiệm "
    order_body["recipient"]["phone"] = "090 123-4567"
    order_body["note"] = "  "
    assert CreateOrder.model_validate(order_body).canonical_payload() == first


@pytest.mark.parametrize("code,status", [
    ("PRICE_CHANGED", 409), ("INSUFFICIENT_STOCK", 409), ("IDEMPOTENCY_CONFLICT", 409),
    ("PRODUCT_NOT_AVAILABLE", 404), ("WAREHOUSE_NOT_AVAILABLE", 404),
    ("VALIDATION_ERROR", 422), ("AMOUNT_OUT_OF_RANGE", 422), ("ORDER_CONFIGURATION_REQUIRED", 503),
])
def test_rpc_business_errors_are_allowlisted_and_sanitized(orders_client, order_body, code, status):
    client, state, _, _ = orders_client
    state["result"] = {"error": {"code": code, "message": "private SQL or recipient details", "details": ["private"]}}
    response = post(client, order_body)
    assert response.status_code == status and response.json()["error"]["code"] == code
    assert "private" not in response.text


@pytest.mark.parametrize("error,status,code", [
    (httpx.ReadTimeout("private"), 503, "DATA_SERVICE_UNAVAILABLE"),
    (httpx.ConnectError("private"), 503, "DATA_SERVICE_UNAVAILABLE"),
    (APIError({"code": "PGRST202", "message": "private"}), 503, "ORDER_DATABASE_NOT_READY"),
    (APIError({"code": "40P01", "message": "private"}), 409, "RETRYABLE_CONFLICT"),
    (APIError({"code": "40001", "message": "private"}), 409, "RETRYABLE_CONFLICT"),
    (APIError({"code": "08006", "message": "private"}), 503, "DATA_SERVICE_UNAVAILABLE"),
    (APIError({"code": "23514", "message": "private"}), 500, "INTERNAL_ERROR"),
    (RuntimeError("private"), 500, "INTERNAL_ERROR"),
])
def test_transport_or_database_errors_are_normalized(orders_client, order_body, error, status, code):
    client, state, _, _ = orders_client
    state["error"] = error
    response = post(client, order_body)
    assert response.status_code == status and response.json()["error"]["code"] == code
    assert "private" not in response.text


@pytest.mark.parametrize("change", ["unknown_error", "missing_replay", "wrong_total", "wrong_line_total", "early_tax"])
def test_invalid_rpc_output_never_returns_success(orders_client, order_body, change):
    client, state, _, _ = orders_client
    if change == "unknown_error": state["result"] = {"error": {"code": "PRIVATE_SQL_ERROR"}}
    if change == "missing_replay": state["result"].pop("replayed")
    if change == "wrong_total": state["result"]["order"]["total"] = "0.21"
    if change == "wrong_line_total": state["result"]["order"]["items"][0]["line_total"] = "0.21"
    if change == "early_tax": state["result"]["order"]["tax_total"] = "0.02"
    assert post(client, order_body).status_code == 500


def test_approved_defaults_and_explicit_bad_configuration_fail_closed(monkeypatch, orders_client, order_body):
    for name in ["ORDER_STOCK_POLICY", "ORDER_PRICE_TAX_MODE", "ORDER_TAX_RATE", "ORDER_TAX_APPLICATION", "CATALOG_CURRENCY", "CATALOG_ACTIVE_STATUS"]:
        monkeypatch.delenv(name, raising=False)
    settings = OrderSettings.from_env()
    assert settings.tax_rate == 10 and settings.tax_application == "invoice"
    client, _, requests, repository = orders_client
    repository.settings = None
    monkeypatch.setenv("ORDER_PRICE_TAX_MODE", "inclusive")
    response = post(client, order_body)
    assert response.status_code == 503 and response.json()["error"]["code"] == "ORDER_CONFIGURATION_REQUIRED"
    assert requests == []


@pytest.mark.parametrize("field,value", [("ORDER_TAX_RATE", "NaN"), ("ORDER_TAX_RATE", "8"), ("ORDER_TAX_APPLICATION", "order"), ("ORDER_STOCK_POLICY", "deduct_now"), ("CATALOG_CURRENCY", "VNDx"), ("CATALOG_ACTIVE_STATUS", "x")])
def test_unsupported_policy_is_rejected(monkeypatch, field, value):
    from app.orders.errors import OrderError
    monkeypatch.setenv(field, value)
    with pytest.raises(OrderError): OrderSettings.from_env()


def test_swagger_documents_creation_replay_validation_and_errors(orders_client):
    client, _, _, _ = orders_client
    schema = client.get("/openapi.json").json()
    operation = schema["paths"]["/api/orders"]["post"]
    assert operation["tags"] == ["Customer Orders"]
    assert operation["parameters"][0]["name"] == "Idempotency-Key"
    assert operation["parameters"][0]["required"]
    assert {"200", "201", "404", "409", "422", "500", "503"} <= operation["responses"].keys()
    assert schema["components"]["schemas"]["CreateOrder"]["additionalProperties"] is False
    assert client.get("/docs").status_code == 200
