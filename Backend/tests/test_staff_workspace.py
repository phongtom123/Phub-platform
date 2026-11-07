"""The new portal split must be enforced at the API, not just the sidebar."""
import pytest
from fastapi.testclient import TestClient
from fastapi import HTTPException
from phub_api.main import app
from phub_api.dependencies.auth import current_user
from phub_api.config.database import get_supabase
from phub_api.models.user import User
from phub_api.services.tables import TablesService, resource_metadata
from phub_api.services.engagement import EngagementService


@pytest.fixture
def workspace_client():
    state = {"role": "ADMIN", "database_calls": []}
    class NoDatabase:
        def __getattr__(self, name):
            state["database_calls"].append(name)
            raise AssertionError("Forbidden request reached a repository")
    app.dependency_overrides[current_user] = lambda: User("ACTOR", "actor", state["role"], "Actor", employee_id="NV1")
    app.dependency_overrides[get_supabase] = NoDatabase
    try:
        with TestClient(app) as client:
            yield client, state
    finally:
        app.dependency_overrides.clear()


@pytest.mark.parametrize("path", [
    "/api/data/products", "/api/data/orders", "/api/data/customers",
    "/api/crm/customers/KH1", "/api/crm/feedback", "/api/admin/orders/DH1/detail",
    "/api/warehouse/receipts", "/api/admin/media/products/SP1/images", "/api/staff/invoice-claims",
])
def test_admin_cannot_open_operational_endpoints(workspace_client, path):
    client, state = workspace_client
    assert client.get(path).status_code == 403
    assert state["database_calls"] == []


@pytest.mark.parametrize("path", [
    "/api/admin/accounts", "/api/admin/accounts/OTHER", "/api/admin/account-owners",
    "/api/admin/operations/read/summary", "/api/admin/operations/business-report?start=2026-11-01&end=2026-11-06",
    "/api/crm/report", "/api/crm/surveys/11111111-1111-4111-8111-111111111111/statistics",
])
def test_staff_cannot_open_accounts_or_reports(workspace_client, path):
    client, state = workspace_client; state["role"] = "NHAN_VIEN"
    assert client.get(path).status_code == 403
    assert state["database_calls"] == []


def test_staff_metadata_has_no_management_permissions_for_employees_or_accounts():
    staff = User("STAFF", "staff", "NHAN_VIEN", "Staff", employee_id="NV1")
    resources = {item["name"]: item for item in resource_metadata(staff)}
    assert "accounts" not in resources
    for name in ["products", "suppliers", "warehouses", "customers", "promotions", "vouchers"]:
        assert resources[name]["writable"] is True
    assert resources["employees"]["writable"] is False
    assert {column["name"] for column in resources["employees"]["columns"]} == {"ma_nhan_vien", "ho_ten", "trang_thai"}


@pytest.mark.parametrize("method,path,body", [
    ("POST", "/api/data/employees", {"ma_nhan_vien":"NEW", "ho_ten":"New", "loai_nhan_vien":"NHAN_VIEN", "ma_kho":1}),
    ("PATCH", '/api/data/employees?key=["NV2"]', {"ho_ten":"Changed"}),
    ("PATCH", '/api/data/employees?key=["NV2"]', {"trang_thai":0}),
    ("GET", '/api/data/employees?filters={"luong":"9000"}', None),
    ("POST", "/api/admin/accounts", {}),
    ("PATCH", "/api/admin/accounts/OTHER", {"email":"changed@example.com"}),
])
def test_staff_cannot_manage_employees_or_accounts(workspace_client, method, path, body):
    client, state = workspace_client; state["role"] = "NHAN_VIEN"
    response = client.request(method, path, json=body, headers={"Origin":"http://localhost:3002"})
    assert response.status_code == 403
    assert state["database_calls"] == []


def test_employee_lookup_does_not_return_private_profile():
    from types import SimpleNamespace
    from phub_api.repositories.tables import selected_columns
    staff = User("STAFF", "staff", "NHAN_VIEN", "Staff", employee_id="NV1")
    class Repository:
        def page(self, *args):
            return SimpleNamespace(data=[{"ma_nhan_vien":"NV2", "ho_ten":"Other", "trang_thai":1,
                "luong":"9000", "cccd":"private", "sdt":"private", "ma_kho":1}], count=1)
    result = TablesService(Repository(), staff).read("employees", 1, 20, "", None, None)
    assert result["data"] == [{"ma_nhan_vien":"NV2", "ho_ten":"Other", "trang_thai":1}]
    assert selected_columns("employees", staff) == "ma_nhan_vien,ho_ten,trang_thai"


def test_admin_keeps_employee_management():
    resources = {item["name"]:item for item in resource_metadata(User("ADMIN", "admin", "ADMIN", "Admin", employee_id="AD1"))}
    assert resources["employees"]["writable"] is True
    assert "luong" in {column["name"] for column in resources["employees"]["columns"]}


def test_employee_form_cannot_create_admin_or_modify_admin_profile():
    class Repository:
        writes = []
        def detail(self, *args): return [{"ma_nhan_vien": "AD1", "loai_nhan_vien": "ADMIN", "ho_ten": "Admin"}]
        def insert(self, *args): self.writes.append(args)
        def update(self, *args): self.writes.append(args)
    repo = Repository()
    service = TablesService(repo, User("STAFF", "staff", "NHAN_VIEN", "Staff", employee_id="NV1"))
    with pytest.raises(HTTPException) as error:
        service.update("employees", '["AD1"]', {"ho_ten": "Changed"})
    assert error.value.status_code == 403 and not repo.writes
    with pytest.raises(HTTPException) as error:
        service.create("employees", {"ma_nhan_vien": "NEW", "loai_nhan_vien": "ADMIN", "ho_ten": "Escalated", "ma_kho": None})
    assert error.value.status_code in {403, 422} and not repo.writes


def test_admin_cannot_mutate_surveys_or_reviews_in_service():
    service = EngagementService(object(), User("ADMIN", "admin", "ADMIN", "Admin", employee_id="NV1"))
    with pytest.raises(HTTPException) as error:
        service.survey_write("create", "unused")
    assert error.value.status_code == 403
    with pytest.raises(HTTPException) as error:
        service.reviews("admin")
    assert error.value.status_code == 403
