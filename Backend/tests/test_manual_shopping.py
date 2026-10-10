import importlib
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def manual_client(monkeypatch):
    monkeypatch.setenv("PHUB_E2E_MODE", "isolated-fixtures")
    monkeypatch.setenv("PHUB_E2E_CONTROL_KEY", "isolated-pytest-controls-key-at-least-32-characters")
    monkeypatch.setenv("PHUB_DEMO_UI_ORIGIN", "http://127.0.0.1:13001")
    module = importlib.import_module("scripts.manual_shopping")
    with module.lock:
        module.reset()
        module.sessions.clear()
    with TestClient(module.app, base_url="http://127.0.0.1:18001", follow_redirects=False) as client:
        yield client


def create_order(client):
    assert client.get("/__manual/login/A").status_code == 303
    quote = client.post("/api/customer/checkout/quote", json={"items": [{"sku": "SKU-A", "quantity": 1}], "voucher_code": "SAVE10"}).json()
    line = quote["items"][0]
    response = client.post("/api/customer/orders", headers={"Idempotency-Key": str(uuid4())}, json={
        "items": [{"sku": "SKU-A", "quantity": 1, "warehouse_id": line["warehouse_id"], "expected_unit_price": line["unit_price"]}],
        "voucher_code": "SAVE10", "expected_total": quote["total"], "expected_discount": quote["discount_total"],
        "recipient": {"name": "Khách thử", "phone": "0901234567", "address_line": "123 Đường thử", "province": "TP Hồ Chí Minh", "ward": "Phường thử"}, "note": None,
    })
    assert response.status_code == 201
    return response.json()["id"]


def test_manual_session_handoff_and_logout_revoke_the_old_session(manual_client):
    client = manual_client
    assert client.get("/__manual").status_code == 200
    assert client.get("/__manual/login/C").status_code == 404
    response = client.get("/__manual/login/A")
    assert response.headers["location"] == "http://127.0.0.1:13001/main/product"
    assert "HttpOnly" in response.headers["set-cookie"]
    token = client.cookies.get("phub-e2e-session")
    assert client.get("/api/customer/me").json()["customer_id"] == "KH-A"
    assert client.get("/__manual/logout").status_code == 303
    client.cookies.set("phub-e2e-session", token)
    assert client.get("/api/customer/me").status_code == 401


@pytest.mark.parametrize("headers", [{}, {"Origin": "https://another.example"}, {"Origin": "http://127.0.0.1:18001", "Sec-Fetch-Site": "cross-site"}])
def test_control_writes_require_local_origin(manual_client, headers):
    assert manual_client.post("/__manual/reset", headers=headers).status_code == 403
    assert manual_client.post("/__manual/payment/success", headers=headers).status_code == 403


@pytest.mark.parametrize("kind,status", [("pending", "pending"), ("success", "succeeded"), ("refund", "succeeded")])
def test_payment_scenarios_are_visible_through_real_payment_router_without_private_references(manual_client, kind, status):
    client = manual_client
    order_id = create_order(client)
    assert client.post(f"/__manual/payment/{kind}", headers={"Origin": "http://127.0.0.1:18001"}).status_code == 303
    response = client.get(f"/api/orders/{order_id}/payments")
    assert response.status_code == 200
    assert "PRIVATE-MANUAL" not in response.text
    assert status in response.text
    client.get("/__manual/login/B")
    assert client.get(f"/api/orders/{order_id}/payments").status_code == 404


def test_reset_and_payment_before_order_creation(manual_client):
    client = manual_client
    headers = {"Origin": "http://127.0.0.1:18001"}
    assert client.post("/__manual/payment/pending", headers=headers).status_code == 409
    order_id = create_order(client)
    assert client.post("/__manual/reset", headers=headers).status_code == 303
    assert client.get(f"/api/customer/orders/{order_id}").status_code == 404
    assert client.get("/api/customer/me").status_code == 200
