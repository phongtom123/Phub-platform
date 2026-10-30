from types import SimpleNamespace
import pytest
from fastapi import HTTPException
from phub_api.services.warehouse_scope import require_operating_warehouse
from phub_api.dependencies.auth import require_warehouse
from phub_api.models.user import User
from phub_api.models.errors import PaymentError
from phub_api.services.checkout import checkout_parameters
from phub_api.services.tables import can_write


def test_fixed_warehouse_boundary_and_staff_assignment():
    require_operating_warehouse(2)
    for value in [1, 3, None]:
        with pytest.raises(HTTPException):
            require_operating_warehouse(value)
    staff = User('W', 'staff', 'NHAN_VIEN', 'Staff', employee_id='NV', warehouse_id=2)
    assert require_warehouse(staff) is staff
    staff.warehouse_id = 1
    with pytest.raises(HTTPException) as error:
        require_warehouse(staff)
    assert error.value.status_code == 403
    assert not can_write('warehouses', User('A', 'admin', 'ADMIN', 'Admin'))


def test_checkout_rejects_other_warehouse_before_rpc():
    with pytest.raises(PaymentError) as error:
        checkout_parameters({'items': [{'sku': 'S', 'warehouse_id': 1}]}, SimpleNamespace(customer_id='C'), create=True)
    assert error.value.code == 'SINGLE_WAREHOUSE'


def test_stock_and_picker_queries_are_scoped_on_server():
    import httpx
    from postgrest import SyncPostgrestClient
    from phub_api.repositories.catalog import CatalogRepository
    from phub_api.repositories.tables import scoped_query
    requests = []
    def handle(request):
        requests.append(request)
        return httpx.Response(200, json=[])
    with httpx.Client(transport=httpx.MockTransport(handle)) as transport:
        client = SyncPostgrestClient('https://offline.test/rest/v1', http_client=transport)
        assert list(CatalogRepository(client).stock('(S)')) == []
        admin = User('A', 'admin', 'ADMIN', 'Admin')
        for name in ['warehouses', 'inventory']:
            scoped_query(name, admin, client).execute()
    assert len(requests) == 3
    assert all(request.url.params['ma_kho'] == 'eq.2' for request in requests)
