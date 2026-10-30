from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from fastapi.exceptions import ResponseValidationError
from postgrest.exceptions import APIError

from phub_api.main import app
from phub_api.config.database import get_supabase
from phub_api.dependencies.auth import current_user
from phub_api.models.user import User


@pytest.fixture
def report_client():
    state = {'role': 'ADMIN', 'calls': [], 'missing': False, 'scope': {'warehouse_id': 2}}
    class Database:
        def rpc(self, name, parameters):
            state['calls'].append((name, parameters))
            if state['missing']:
                raise APIError({'code': 'PGRST202', 'message': 'missing function', 'details': '', 'hint': ''})
            return SimpleNamespace(execute=lambda: SimpleNamespace(data={
                **state['scope'],
                'start': parameters['p_start'], 'end': parameters['p_end'], 'method': 'MOVING_WEIGHTED_AVERAGE', 'basis': 'COMPLETED_ORDERS',
                **{field: '0.00' for field in ['net_revenue', 'tax', 'discounts', 'gross_revenue', 'collected', 'refunds', 'cost', 'known_cost', 'gross_profit']},
                'margin': None, 'order_count': 0, 'quantity': 0, 'costed_lines': 0, 'total_lines': 0, 'warnings': [], 'products': [], 'daily': [],
            }))
    app.dependency_overrides[current_user] = lambda: User('A', 'admin', state['role'], 'Admin', employee_id='NV1')
    app.dependency_overrides[get_supabase] = Database
    try:
        with TestClient(app) as client:
            yield client, state
    finally:
        app.dependency_overrides.clear()


def test_report_is_read_only_scoped_and_dates_are_bounded(report_client):
    client, state = report_client
    url = '/api/admin/operations/business-report'
    response = client.get(url + '?start=2026-10-01&end=2026-10-30')
    assert response.status_code == 200, response.text
    assert response.headers['cache-control'] == 'no-store'
    assert response.json()['warehouse_id'] == 2
    assert response.json()['gross_profit'] == '0.00' and response.json()['margin'] is None
    assert state['calls'] == [('admin_business_report_v1', {'p_actor': 'A', 'p_start': '2026-10-01', 'p_end': '2026-10-30'})]
    state['calls'].clear()
    for query in ['', '?start=2026-10-31&end=2026-10-01', '?start=2024-01-01&end=2026-10-31', '?start=9999-12-01&end=9999-12-31']:
        assert client.get(url + query).status_code == 422
    assert state['calls'] == []
    state['role'] = 'NHAN_VIEN'
    assert client.get(url + '?start=2026-10-01&end=2026-10-30').status_code == 403
    assert state['calls'] == []


def test_missing_report_function_is_actionable(report_client):
    client, state = report_client
    state['missing'] = True
    response = client.get('/api/admin/operations/business-report?start=2026-10-01&end=2026-10-30')
    assert response.status_code == 503
    assert 'business_report' in response.json()['detail']


@pytest.mark.parametrize('scope', [{}, {'warehouse_id': None}, {'warehouse_id': 1}, {'warehouse_id': 3}])
def test_report_requires_database_to_confirm_operating_warehouse(report_client, scope):
    client, state = report_client
    state['scope'] = scope
    with pytest.raises(ResponseValidationError) as error:
        client.get('/api/admin/operations/business-report?start=2026-10-01&end=2026-10-30')
    assert any(item['loc'] == ('response', 'warehouse_id') for item in error.value.errors())


def test_openapi_report_requires_warehouse_scope():
    schema = app.openapi()['components']['schemas']['BusinessReport']
    assert 'warehouse_id' in schema['required']
    assert schema['properties']['warehouse_id']['const'] == 2
