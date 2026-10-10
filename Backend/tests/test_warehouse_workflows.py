"""Offline contract tests for atomic warehouse workflows."""
import pytest
from fastapi.testclient import TestClient

from app.auth import User, current_user
from app.main import app
from app.warehouse.repository import WarehouseRepository
from app.warehouse.router import get_repository


class FakeRpcCall:
    def __init__(self, data):
        self.data = data

    def execute(self):
        return type("Result", (), {"data": self.data})()


class FakeDatabase:
    def __init__(self):
        self.calls = []

    def rpc(self, name, params):
        self.calls.append((name, params))
        return FakeRpcCall({
            "ma_phieu_nhap": params["p_ma_phieu_nhap"],
            "ma_phieu_code": "PN-TEST-001",
            "ma_kho": params["p_ma_kho_duoc_phep"] or 7,
            "trang_thai": "DA_NHAP",
            "nguoi_xac_nhan": params["p_nguoi_xac_nhan"],
        })


ADMIN = User("TK1", "admin", "ADMIN", "Quản trị", employee_id="NV1")
WAREHOUSE = User("TK2", "kho", "THU_KHO", "Thủ kho", employee_id="NV2", warehouse_id=7)
CUSTOMER = User("TK3", "khach", "KHACH_HANG", "Khách hàng", customer_id="KH3")


@pytest.fixture
def workflow_client():
    database = FakeDatabase()
    app.dependency_overrides[get_repository] = lambda: WarehouseRepository(database)
    app.dependency_overrides[current_user] = lambda: WAREHOUSE
    with TestClient(app) as client:
        yield client, database
    app.dependency_overrides.pop(get_repository, None)
    app.dependency_overrides.pop(current_user, None)


def test_warehouse_confirmation_passes_assigned_warehouse(workflow_client):
    client, database = workflow_client
    response = client.post("/api/warehouse/receipts/12/confirm")
    assert response.status_code == 200
    assert database.calls == [("confirm_receipt", {
        "p_ma_phieu_nhap": 12,
        "p_nguoi_xac_nhan": "NV2",
        "p_ma_kho_duoc_phep": 7,
    })]
    assert response.json()["trang_thai"] == "DA_NHAP"


def test_admin_confirmation_has_no_warehouse_restriction(workflow_client):
    client, database = workflow_client
    app.dependency_overrides[current_user] = lambda: ADMIN
    response = client.post("/api/warehouse/receipts/18/confirm")
    assert response.status_code == 200
    assert database.calls[-1][1]["p_ma_kho_duoc_phep"] is None


def test_customer_cannot_confirm_receipt(workflow_client):
    client, database = workflow_client
    app.dependency_overrides[current_user] = lambda: CUSTOMER
    response = client.post("/api/warehouse/receipts/12/confirm")
    assert response.status_code == 403
    assert database.calls == []
