from types import SimpleNamespace
import pytest
from fastapi import HTTPException
from phub_api.services.warehouse_scope import require_warehouse_id
from phub_api.dependencies.auth import require_warehouse
from phub_api.models.user import User
from phub_api.services.checkout import checkout_parameters
from phub_api.services.tables import can_write


def test_all_warehouses_allowed_with_staff_assignment_preserved():
    for value in [1, 2, 3, 4]:
        require_warehouse_id(value)
    for value in [None, True, '2', 2.5, 2**31]:
        with pytest.raises(HTTPException):
            require_warehouse_id(value)
    staff = User('W', 'staff', 'NHAN_VIEN', 'Staff', employee_id='NV', warehouse_id=2)
    assert require_warehouse(staff) is staff
    staff.warehouse_id = 1
    assert require_warehouse(staff) is staff
    staff.warehouse_id = None
    with pytest.raises(HTTPException):
        require_warehouse(staff)
    assert can_write('warehouses', User('A', 'admin', 'ADMIN', 'Admin'))
    assert not can_write('warehouses', staff)


def test_checkout_passes_selected_warehouses_to_atomic_rpc():
    settings = SimpleNamespace(stock_policy='reserve_on_order', price_tax_mode='exclusive', tax_rate=10,
                               currency='VND', active_status=1, tax_application='invoice')
    payload = {'items': [{'sku': 'S', 'warehouse_id': 1}, {'sku': 'T', 'warehouse_id': 3}]}
    result = checkout_parameters(payload, SimpleNamespace(customer_id='C'), create=True, settings=settings)
    assert result['p_request'] == payload
    assert result['p_create'] is True


def test_staff_read_queries_cover_all_warehouses_while_auth_stays_assigned():
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
        staff = User('W', 'staff', 'NHAN_VIEN', 'Staff', employee_id='NV', warehouse_id=3)
        for name in ['warehouses', 'inventory', 'receipts']:
            scoped_query(name, staff, client).execute()
    assert len(requests) == 6
    assert requests[0].url.params['warehouse.trang_thai'] == 'eq.1'
    assert all('ma_kho' not in request.url.params for request in requests[:3])
    assert all('ma_kho' not in request.url.params for request in requests[3:])
