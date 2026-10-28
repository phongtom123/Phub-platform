"""Services can be exercised with in-memory repository doubles, without a web app/SDK."""
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from phub_api.config.orders import OrderSettings
from phub_api.models.customer import CurrentCustomer
from phub_api.models.errors import OrderError, PaymentError
from phub_api.models.user import User
from phub_api.services.admin_accounts import AccountsService
from phub_api.services.auth import AuthService, credential_state, password_version
from phub_api.services.catalog_availability import available_skus
from phub_api.services.orders import OrderService
from phub_api.services.payments import PaymentService


def test_auth_rechecks_persisted_role_and_password_version(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "test-only-" + "x" * 64)
    account = {"ma_tk": "A", "ten_tai_khoan": "admin", "trang_thai": 1, "ma_nhan_vien": "N", "ma_kh": None, "mat_khau": "hash"}
    account["phien_ban_mat_khau"] = "00000000-0000-4000-8000-000000000001"
    profile = {"ma_nhan_vien": "N", "ho_ten": "Admin", "loai_nhan_vien": "ADMIN", "ma_kho": None, "trang_thai": 1}
    repository = SimpleNamespace(account=lambda identifier: [account], employee=lambda identifier: [profile])
    service = AuthService(repository)
    claims = {"sub": "A", "ver": password_version(credential_state(account))}
    assert service.current_user(claims).role == "ADMIN"
    profile.update(loai_nhan_vien="NHAN_VIEN", ma_kho=-7)
    assert service.current_user(claims).warehouse_id == -7
    account["mat_khau"] = "changed"
    with pytest.raises(HTTPException) as error:
        service.current_user(claims)
    assert error.value.status_code == 401


def test_account_service_prevents_self_lock_before_any_write():
    writes = []
    repository = SimpleNamespace(
        account=lambda identifier: [{"ma_tk": identifier}],
        update=lambda *args: writes.append(args),
    )
    actor = User("A", "admin", "ADMIN", "Admin")
    with pytest.raises(HTTPException) as error:
        AccountsService(repository, actor).status("A", 0)
    assert error.value.status_code == 409 and writes == []


def test_availability_is_a_read_model_not_an_sdk_query_builder():
    repository = SimpleNamespace(
        reservations=lambda *args: [{"sku": "S", "ma_kho_xuat": -1, "so_luong": 3}],
        stock=lambda *args: [{"sku": "S", "ma_kho": -1, "so_luong_ton": 3}, {"sku": "T", "ma_kho": 2, "so_luong_ton": 1}],
    )
    assert available_skus(repository, ["S", "T"]) == {"T"}


def test_order_service_keeps_atomic_rpc_error_semantics():
    order_body = {
        "recipient": {"name": "Khách test", "phone": "0901234567", "address_line": "Địa chỉ test", "province": "TP HCM", "ward": "Phường 1"},
        "items": [{"sku": "SKU-TEST", "warehouse_id": -1, "quantity": 2, "expected_unit_price": "0.10"}],
    }
    calls = []
    def checkout(parameters):
        calls.append(parameters)
        return {"error": {"code": "INSUFFICIENT_STOCK"}}
    service = OrderService(SimpleNamespace(checkout=checkout), OrderSettings("reserve_on_order", "exclusive", Decimal("10"), "VND", 1))
    from phub_api.schemas.orders import CreateOrder
    with pytest.raises(OrderError) as error:
        service.create(CreateOrder.model_validate(order_body), uuid4(), CurrentCustomer(customer_id="K"))
    assert error.value.status_code == 409 and len(calls) == 1
    assert calls[0]["p_customer_id"] == "K" and calls[0]["p_create"] is True


def test_payment_service_checks_ownership_before_payment_provider():
    calls = []
    repository = SimpleNamespace(currency="VND", owned_order=lambda *args: [])
    provider = SimpleNamespace(request=lambda *args: calls.append(args))
    with pytest.raises(PaymentError) as error:
        PaymentService(repository, provider).request("O", CurrentCustomer(customer_id="K"), "cash", uuid4())
    assert error.value.status_code == 404 and calls == []
