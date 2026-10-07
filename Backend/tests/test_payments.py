from decimal import Decimal
from uuid import uuid4
import importlib.util
from pathlib import Path
import sys
from types import ModuleType, SimpleNamespace

import httpx
import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from postgrest import SyncPostgrestClient
from postgrest.exceptions import APIError

from app.payments.auth import CurrentCustomer, require_customer
from app.payments.errors import PaymentError
from app.payments.repository import PaymentRepository
from app.payments.router import get_repository, router


ORDER_ID = "ORDER-A"
CUSTOMER_ID = "CUSTOMER-A"
BASE = f"/api/orders/{ORDER_ID}"


@pytest.fixture
def payments_client():
    row = {
        "so_tien": "100000.10", "loai_giao_dich": "THU", "phuong_thuc": "CHUYEN_KHOAN",
        "trang_thai": "CHO_XU_LY", "thoi_gian": "2026-10-06T10:00:00",
        "owned_order": {"ma_donhang": ORDER_ID, "ma_kh": CUSTOMER_ID},
        # Inject extra internal data to ensure it cannot accidentally be returned.
        "ma_thanh_toan": "PRIVATE-PAYMENT", "ma_giao_dich": "PRIVATE-PROVIDER",
        "token": "PRIVATE-TOKEN", "bank_account": "PRIVATE-BANK", "payload": {"secret": "PRIVATE-PAYLOAD"},
    }
    state = {
        "orders": [{"ma_donhang": ORDER_ID, "ma_kh": CUSTOMER_ID}],
        "rows": [row], "total": 1, "error": None, "error_table": None,
    }
    requests = []

    def handle(request):
        requests.append(request)
        table = request.url.path.rsplit("/", 1)[-1]
        if state["error"] and (state["error_table"] is None or state["error_table"] == table) and (state.get("error_method") is None or state["error_method"] == request.method):
            raise state["error"]
        if table == "DON_HANG":
            return httpx.Response(200, json=state["orders"])
        assert table == "THANH_TOAN"
        total = state["total"]
        headers = {} if total is None else {"content-range": f"0-{max(0, len(state['rows']) - 1)}/{total}"}
        if request.method == "HEAD":
            return httpx.Response(200, headers=headers)
        return httpx.Response(200, json=state["rows"], headers=headers)

    with httpx.Client(transport=httpx.MockTransport(handle)) as transport:
        db = SyncPostgrestClient("https://payments.test/rest/v1", http_client=transport)
        repository = PaymentRepository(db)
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[get_repository] = lambda: repository
        app.dependency_overrides[require_customer] = lambda: CurrentCustomer(customer_id=CUSTOMER_ID)
        with TestClient(app) as client:
            yield client, state, requests, repository, app


@pytest.mark.parametrize("endpoint", ["payments", "transactions"])
@pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer forged-token", "X-Customer-Id": CUSTOMER_ID, "Cookie": "ma_kh=CUSTOMER-A"}])
def test_unconnected_auth_blocks_every_request_before_database(payments_client, endpoint, headers):
    client, _, requests, _, app = payments_client
    app.dependency_overrides.pop(require_customer)
    response = client.get(f"{BASE}/{endpoint}", headers=headers)
    assert response.status_code == 503
    assert response.json() == {"error": {
        "code": "AUTH_INTEGRATION_REQUIRED",
        "message": "Chưa kết nối phần xác thực khách hàng. Không thể sử dụng chức năng mua hàng lúc này.", "details": [],
    }}
    assert response.headers["Cache-Control"] == "no-store"
    assert requests == []


def test_overview_exact_money_pending_and_public_fields(payments_client):
    client, _, requests, _, _ = payments_client
    response = client.get(f"{BASE}/payments")
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"order_id", "currency", "latest_transaction", "message"}
    assert body["order_id"] == ORDER_ID and body["currency"] == "VND"
    transaction = body["latest_transaction"]
    assert set(transaction) == {"type", "method", "amount", "status", "occurred_at", "message"}
    assert transaction["type"] == "collection" and transaction["method"] == "bank_transfer"
    assert transaction["amount"] == "100000.10" and transaction["status"] == "pending"
    assert "chưa được xác nhận thành công" in transaction["message"]
    assert "PRIVATE" not in response.text
    assert response.headers["Cache-Control"] == "no-store"
    assert [request.method for request in requests] == ["GET", "GET"]
    assert requests[0].url.params["select"] == "ma_donhang,ma_kh"
    assert requests[0].url.params["ma_kh"] == 'eq.CUSTOMER-A'
    params = requests[1].url.params
    assert params["owned_order.ma_kh"] == 'eq.CUSTOMER-A'
    assert params["ma_donhang"] == 'eq.ORDER-A'
    assert params["limit"] == "1"
    assert params["order"] == "thoi_gian.desc.nullslast,ma_thanh_toan.desc"
    assert "so_tien::text" in params["select"] and "DON_HANG!inner" in params["select"]
    assert "ma_giao_dich" not in params["select"] and "ma_thanh_toan" not in params["select"] and "*" not in params["select"]


def test_paginated_history_filters_owner_and_counts_all_types(payments_client):
    client, state, requests, _, _ = payments_client
    state["total"] = 21
    response = client.get(f"{BASE}/transactions", params={"page": 2, "page_size": 10})
    assert response.status_code == 200
    body = response.json()
    assert body["pagination"] == {"page": 2, "page_size": 10, "total": 21, "total_pages": 3}
    assert body["items"][0]["status"] == "pending"
    assert "PRIVATE" not in response.text
    params = requests[-1].url.params
    assert params["offset"] == "10" and params["limit"] == "10"
    assert params["owned_order.ma_kh"] == 'eq.CUSTOMER-A'
    assert "count=exact" in requests[-1].headers["prefer"]
    assert "loai_giao_dich" not in params  # includes both collections and refunds


@pytest.mark.parametrize("endpoint", ["payments", "transactions"])
@pytest.mark.parametrize("orders", [[], [{"ma_donhang": ORDER_ID, "ma_kh": "CUSTOMER-B"}], [{"ma_donhang": ORDER_ID, "ma_kh": None}]])
def test_missing_foreign_and_guest_orders_are_indistinguishable(payments_client, endpoint, orders):
    client, state, requests, _, _ = payments_client
    state["orders"] = orders
    response = client.get(f"{BASE}/{endpoint}")
    assert response.status_code == 404
    assert response.json() == {"error": {"code": "ORDER_NOT_FOUND", "message": "Không tìm thấy đơn hàng thuộc tài khoản của bạn.", "details": []}}
    assert len(requests) == 1 and "CUSTOMER-B" not in response.text


@pytest.mark.parametrize("endpoint", ["payments", "transactions"])
def test_ownership_change_between_queries_does_not_expose_transactions(payments_client, endpoint):
    client, state, _, _, _ = payments_client
    state["rows"][0]["owned_order"]["ma_kh"] = "CUSTOMER-B"
    response = client.get(f"{BASE}/{endpoint}")
    assert response.status_code == 404
    assert "100000" not in response.text and "PRIVATE" not in response.text


def test_owned_order_without_transactions_is_not_reported_paid(payments_client):
    client, state, _, _, _ = payments_client
    state["rows"], state["total"] = [], 0
    overview = client.get(f"{BASE}/payments").json()
    assert overview["latest_transaction"] is None
    assert "chưa thể kết luận đã thanh toán" in overview["message"]
    history = client.get(f"{BASE}/transactions").json()
    assert history["items"] == []
    assert history["pagination"] == {"page": 1, "page_size": 20, "total": 0, "total_pages": 0}


def test_history_page_beyond_end_is_empty(payments_client):
    client, state, _, _, _ = payments_client
    state["rows"] = []
    response = client.get(f"{BASE}/transactions?page=2&page_size=20")
    assert response.status_code == 200
    assert response.json()["items"] == [] and response.json()["pagination"]["total"] == 1


def test_postgrest_416_fallback_recounts_without_losing_ownership_filters(payments_client):
    client, state, requests, _, _ = payments_client
    state.update(error=APIError({"code": "PGRST103", "message": "Range not satisfiable", "details": "", "hint": ""}),
                 error_table="THANH_TOAN", error_method="GET")
    response = client.get(f"{BASE}/transactions?page=2&page_size=20")
    assert response.status_code == 200
    assert response.json()["items"] == [] and response.json()["pagination"]["total"] == 1
    assert requests[-1].method == "HEAD"
    assert requests[-1].url.params["owned_order.ma_kh"] == 'eq.CUSTOMER-A'
    assert requests[-1].url.params["ma_donhang"] == 'eq.ORDER-A'
    assert "offset" not in requests[-1].url.params and "ma_giao_dich" not in requests[-1].url.params["select"]


@pytest.mark.parametrize("raw,expected", [("CHO_XU_LY", "pending"), ("THANH_CONG", "succeeded"), ("THAT_BAI", "failed"), ("NEW_PRIVATE_STATE", "unknown")])
def test_status_mapping_is_explicit_and_does_not_expose_unknown_raw_values(payments_client, raw, expected):
    client, state, _, _, _ = payments_client
    state["rows"][0]["trang_thai"] = raw
    response = client.get(f"{BASE}/payments")
    assert response.status_code == 200
    assert response.json()["latest_transaction"]["status"] == expected
    assert raw not in response.text


@pytest.mark.parametrize("raw,expected", [("TIEN_MAT", "cash"), ("CHUYEN_KHOAN", "bank_transfer"), ("THE", "card"), ("VI_DIEN_TU", "e_wallet"), ("PRIVATE_METHOD", "unknown")])
def test_method_mapping(payments_client, raw, expected):
    client, state, _, _, _ = payments_client
    state["rows"][0]["phuong_thuc"] = raw
    response = client.get(f"{BASE}/payments")
    assert response.json()["latest_transaction"]["method"] == expected
    assert raw not in response.text


@pytest.mark.parametrize("raw,expected", [("THU", "collection"), ("HOAN_TIEN", "refund"), ("PRIVATE_TYPE", "unknown")])
def test_refunds_and_unknown_types_are_not_mislabeled_as_collections(payments_client, raw, expected):
    client, state, _, _, _ = payments_client
    state["rows"][0].update(loai_giao_dich=raw, trang_thai="THANH_CONG")
    response = client.get(f"{BASE}/payments")
    assert response.json()["latest_transaction"]["type"] == expected
    assert raw not in response.text
    if expected == "refund":
        assert "hoàn tiền" in response.json()["message"]


@pytest.mark.parametrize("amount", ["0.00", "0.10", "9999999999999999.99"])
def test_decimal_strings_preserve_exact_money_without_adding_tax(payments_client, amount):
    client, state, _, _, _ = payments_client
    state["rows"][0]["so_tien"] = amount
    response = client.get(f"{BASE}/payments")
    assert response.status_code == 200
    assert Decimal(response.json()["latest_transaction"]["amount"]) == Decimal(amount)


@pytest.mark.parametrize("amount", [0.1, "-1.00", "0.001", "NaN", "Infinity", "10000000000000000.00"])
def test_invalid_database_money_fails_without_leaking_raw_record(payments_client, amount):
    client, state, _, _, _ = payments_client
    state["rows"][0]["so_tien"] = amount
    response = client.get(f"{BASE}/payments")
    assert response.status_code == 500 and response.json()["error"]["code"] == "INTERNAL_ERROR"
    assert "PRIVATE" not in response.text


@pytest.mark.parametrize("query", ["page=0", "page=-1", "page=1000001", "page=abc", "page=1.5", "page_size=0", "page_size=101", "ma_kh=CUSTOMER-B", "token=forged", "sort=amount"])
def test_invalid_query_cannot_reach_database(payments_client, query):
    client, _, requests, _, _ = payments_client
    response = client.get(f"{BASE}/transactions?{query}")
    assert response.status_code == 422 and response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert response.json()["error"]["details"] and requests == []


def test_overview_rejects_client_supplied_customer_id(payments_client):
    client, _, requests, _, _ = payments_client
    response = client.get(f"{BASE}/payments?ma_kh=CUSTOMER-B")
    assert response.status_code == 422 and requests == []


@pytest.mark.parametrize("order_id", ["x" * 101, "   ", "BAD\x01"])
def test_invalid_order_id(payments_client, order_id):
    client, _, requests, _, _ = payments_client
    from urllib.parse import quote
    response = client.get(f"/api/orders/{quote(order_id, safe='')}/payments")
    assert response.status_code == 422 and requests == []


def test_equality_identifiers_are_encoded_as_single_query_values(payments_client):
    _, state, requests, repository, _ = payments_client
    order_id = 'A,B).or(ma_kh.eq.OTHER)"\\'
    customer_id = 'C,D).or(ma_kh.eq.OTHER)"\\'
    customer = CurrentCustomer(customer_id=customer_id)
    state["orders"] = [{"ma_donhang": order_id, "ma_kh": customer_id}]
    state["rows"] = []
    result = repository.overview(order_id, customer)
    assert result.latest_transaction is None
    for request in requests:
        assert request.url.params["ma_donhang"] == "eq." + order_id
        assert "or" not in request.url.params
    assert requests[0].url.params["ma_kh"] == "eq." + customer_id
    assert requests[-1].url.params["owned_order.ma_kh"] == "eq." + customer_id
    assert "or" not in requests[-1].url.params


def test_repository_rejects_unverified_customer_dict_before_reading(payments_client):
    _, _, requests, repository, _ = payments_client
    with pytest.raises(PaymentError) as error:
        repository.overview(ORDER_ID, {"customer_id": CUSTOMER_ID})
    assert error.value.code == "AUTH_INTEGRATION_REQUIRED" and requests == []


@pytest.mark.parametrize("status,code", [(401, "AUTHENTICATION_REQUIRED"), (403, "ACCESS_DENIED")])
def test_existing_auth_errors_are_normalized_without_leaking_details(payments_client, status, code):
    client, _, requests, _, app = payments_client

    def rejected_auth():
        raise HTTPException(status, detail="PRIVATE-TOKEN", headers={"WWW-Authenticate": "Bearer"})

    app.dependency_overrides[require_customer] = rejected_auth
    response = client.get(f"{BASE}/payments")
    assert response.status_code == status and response.json()["error"]["code"] == code
    assert "PRIVATE" not in response.text and requests == []
    if status == 401:
        assert response.headers["WWW-Authenticate"] == "Bearer"


@pytest.mark.parametrize("error,expected_status,expected_code", [
    (httpx.ConnectError("PRIVATE-CREDENTIAL"), 503, "DATA_SERVICE_UNAVAILABLE"),
    (httpx.ReadTimeout("PRIVATE-CREDENTIAL"), 503, "DATA_SERVICE_UNAVAILABLE"),
    (APIError({"code": "PGRST200", "message": "PRIVATE-SCHEMA", "details": "PRIVATE", "hint": "PRIVATE"}), 503, "PAYMENT_SCHEMA_NOT_READY"),
    (APIError({"code": "42P01", "message": "PRIVATE-SCHEMA", "details": "PRIVATE", "hint": "PRIVATE"}), 503, "PAYMENT_SCHEMA_NOT_READY"),
    (APIError({"code": "42703", "message": "PRIVATE-SCHEMA", "details": "PRIVATE", "hint": "PRIVATE"}), 503, "PAYMENT_SCHEMA_NOT_READY"),
    (APIError({"code": "57014", "message": "PRIVATE-SQL", "details": "PRIVATE", "hint": "PRIVATE"}), 503, "DATA_SERVICE_UNAVAILABLE"),
    (APIError({"code": "40001", "message": "PRIVATE-SQL", "details": "PRIVATE", "hint": "PRIVATE"}), 503, "DATA_SERVICE_UNAVAILABLE"),
    (APIError({"code": "42501", "message": "PRIVATE-SQL", "details": "PRIVATE", "hint": "PRIVATE"}), 500, "INTERNAL_ERROR"),
    (RuntimeError("PRIVATE-PAYMENT"), 500, "INTERNAL_ERROR"),
])
def test_database_and_transport_errors_are_sanitized(payments_client, error, expected_status, expected_code, caplog):
    client, state, _, _, _ = payments_client
    state["error"], state["error_table"] = error, "THANH_TOAN"
    response = client.get(f"{BASE}/payments")
    assert response.status_code == expected_status and response.json()["error"]["code"] == expected_code
    assert set(response.json()["error"]) == {"code", "message", "details"}
    assert "PRIVATE" not in response.text and "PRIVATE" not in caplog.text
    assert response.headers["Cache-Control"] == "no-store"


def test_history_refuses_missing_count_and_corrupt_ownership_shape(payments_client):
    client, state, _, _, _ = payments_client
    state["total"] = None
    response = client.get(f"{BASE}/transactions")
    assert response.status_code == 500
    state["rows"][0].pop("owned_order")
    response = client.get(f"{BASE}/payments")
    assert response.status_code == 500 and "PRIVATE" not in response.text


def test_all_payment_paths_and_contracts_are_in_swagger(payments_client):
    client, _, _, _, _ = payments_client
    spec = client.get("/openapi.json").json()
    for suffix, schema in [("payments", "PaymentOverview"), ("transactions", "TransactionPage")]:
        operation = spec["paths"][f"/api/orders/{{order_id}}/{suffix}"]["get"]
        assert operation["tags"] == ["Customer Payments"]
        assert "AUTH_INTEGRATION_REQUIRED" in operation["description"] or "503" in operation["description"]
        assert set(operation["responses"]) == {"200", "401", "403", "404", "422", "500", "503"}
        assert operation["responses"]["200"]["content"]["application/json"]["schema"]["$ref"].endswith(schema)
        assert operation["responses"]["503"]["content"]["application/json"]["example"]["error"]["code"] == "AUTH_INTEGRATION_REQUIRED"
    fields = spec["components"]["schemas"]["PaymentTransaction"]["properties"]
    assert set(fields) == {"type", "method", "amount", "status", "occurred_at", "message"}
    assert fields["amount"]["type"] == "string"
    assert "/api/orders/{order_id}/payment-request" in spec["paths"]


@pytest.mark.parametrize("method", ["cash", "bank_transfer", "card", "e_wallet"])
def test_real_payment_execution_remains_unconnected_and_read_only(payments_client, method):
    client, _, requests, _, _ = payments_client
    response = client.post(f"{BASE}/payment-request", json={"method":method}, headers={"Idempotency-Key":str(uuid4())})
    assert response.status_code == 503 and response.json()["error"]["code"] == "PAYMENT_INTEGRATION_REQUIRED"
    assert all(request.method == "GET" and request.url.path.endswith("/DON_HANG") for request in requests)


@pytest.mark.parametrize("body", [{}, {"method":"invalid"}, {"method":"cash","amount":"1.00"}, {"method":"cash","ma_kh":"KH-B"}, {"method":"cash","ma_giao_dich":"FORGED"}])
def test_payment_request_validates_method_and_rejects_amount_or_identity(payments_client, body):
    client, _, requests, _, _ = payments_client
    result = client.post(f"{BASE}/payment-request", json=body, headers={"Idempotency-Key":str(uuid4())})
    assert result.status_code == 422 and requests == []


def test_payment_request_foreign_order_and_invalid_idempotency_are_blocked(payments_client):
    client, state, requests, _, app = payments_client
    result = client.post(f"{BASE}/payment-request", json={"method":"cash"}, headers={"Idempotency-Key":"x"*36})
    assert result.status_code == 422 and requests == []
    state["orders"] = []
    result = client.post(f"{BASE}/payment-request", json={"method":"cash"}, headers={"Idempotency-Key":str(uuid4())})
    assert result.status_code == 404
    app.dependency_overrides.pop(require_customer)
    requests.clear()
    assert client.post(f"{BASE}/payment-request", json={"method":"cash"}, headers={"Idempotency-Key":str(uuid4())}).status_code == 503
    assert requests == []


def test_main_registers_payments_without_requiring_auth_at_startup(monkeypatch):
    stub = ModuleType("app.supabase")
    stub.supabase = SimpleNamespace()
    monkeypatch.setitem(sys.modules, "app.supabase", stub)
    location = Path(__file__).resolve().parents[1] / "app" / "main.py"
    spec = importlib.util.spec_from_file_location("app.payment_main_check", location)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    with TestClient(module.app) as client:
        assert client.get("/docs").status_code == 200
        assert client.get(f"{BASE}/payments").json()["error"]["code"] == "AUTH_INTEGRATION_REQUIRED"
        paths = client.get("/openapi.json").json()["paths"]
        assert "/api/catalog/products" in paths and "/api/orders" in paths
        assert "/api/orders/{order_id}/transactions" in paths
