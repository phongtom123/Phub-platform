from copy import deepcopy

import httpx
import pytest
from fastapi.testclient import TestClient
from postgrest import SyncPostgrestClient

from phub_api.config.database import get_supabase
from phub_api.dependencies.auth import current_user
from phub_api.main import app
from phub_api.models.user import User

ADMIN = User("TK1", "admin", "ADMIN", "Admin", employee_id="NV1")
ORDER = "ORDER-DETAIL-TEST"
URL = f"/api/admin/orders/{ORDER}/detail"


@pytest.fixture
def detail_client():
    payment = lambda id, amount, kind="THU", status="THANH_CONG": {
        "ma_thanh_toan": id, "ma_donhang": ORDER, "so_tien": amount,
        "loai_giao_dich": kind, "trang_thai": status,
    }
    state = {"actor": ADMIN, "bad_count": False, "db_error": False, "tables": {
        "DON_HANG": [{"ma_donhang": ORDER, "ma_kh": "KH1", "ma_nhan_vien": "NV1", "trang_thai": "XAC_NHAN", "secret": "hidden"}],
        "KHACH_HANG": [{"ma_kh": "KH1", "ten_kh": "Customer", "sdt": "123", "mat_khau": "hidden"}],
        "NHAN_VIEN": [{"ma_nhan_vien": "NV1", "ho_ten": "Admin", "luong": "hidden", "cccd": "hidden"}],
        "CT_DON_HANG": [{"ma_ct_donhang": 1, "ma_donhang": ORDER, "sku": "SKU1", "ma_kho_xuat": 1, "don_gia": "5.00"}],
        "HOA_DON": [{"ma_hoadon": "HD1", "ma_donhang": ORDER, "tong_tien_sau_thue": "1000.30"}],
        "THANH_TOAN": [payment(1, "200.10"), payment(2, "50.05", "HOAN_TIEN"), payment(3, "999.00", status="CHO_XU_LY"), payment(4, "999.00", status="THAT_BAI")],
        "SU_DUNG_VOUCHER": [],
    }}
    requests = []
    def handle(request):
        requests.append(request)
        assert request.method == "GET"
        name = request.url.path.rsplit("/", 1)[-1]
        if state["db_error"] and name == "THANH_TOAN":
            return httpx.Response(500, json={"code": "XX000", "message": "internal db error"})
        rows = deepcopy(state["tables"][name])
        if name not in {"KHACH_HANG", "NHAN_VIEN"}:
            assert request.url.params["ma_donhang"] == f"eq.{ORDER}"
        assert "*" not in request.url.params["select"]
        start = int(request.url.params.get("offset", 0))
        size = int(request.url.params.get("limit", 100))
        count = len(rows) + (1 if state["bad_count"] and name == "THANH_TOAN" else 0)
        return httpx.Response(200, json=rows[start:start + size], headers={"content-range": f"{start}-{max(start, min(start+size, len(rows))-1)}/{count}"})
    with httpx.Client(transport=httpx.MockTransport(handle)) as transport:
        db = SyncPostgrestClient("https://fake.test/rest/v1", http_client=transport)
        app.dependency_overrides[get_supabase] = lambda: db
        app.dependency_overrides[current_user] = lambda: state["actor"]
        try:
            with TestClient(app) as client:
                yield client, state, requests
        finally:
            app.dependency_overrides.clear()


def test_full_aggregate_is_scoped_private_and_exact(detail_client):
    client, _, requests = detail_client
    response = client.get(URL)
    assert response.status_code == 200, response.text
    assert response.headers["cache-control"] == "no-store"
    body = response.json()
    assert body["order_id"] == ORDER
    assert len(body["lines"]) == 1 and len(body["payments"]) == 4
    assert body["invoice"]["ma_hoadon"] == "HD1" and body["voucher_uses"] == []
    assert body["customer"] == {"ma_kh": "KH1", "ten_kh": "Customer", "sdt": "123"}
    assert body["employee"] == {"ma_nhan_vien": "NV1", "ho_ten": "Admin"}
    assert "hidden" not in response.text
    assert body["financial"] == {
        "invoice_id": "HD1", "invoice_status": "DA_LAP", "payment_status": "THU_MOT_PHAN",
        "total": "1000.30", "collected": "200.10", "refunded": "50.05", "paid": "150.05", "remaining": "850.25",
    }
    assert len(requests) == 7
    assert "tong_tien_sau_thue::text" in next(r for r in requests if r.url.path.endswith("HOA_DON")).url.params["select"]


def test_all_pages_and_warehouse_lines_preserved(detail_client):
    client, state, requests = detail_client
    state["tables"]["CT_DON_HANG"] = [{"ma_ct_donhang": i, "ma_donhang": ORDER, "sku": "SKU1", "ma_kho_xuat": i, "so_luong": 1} for i in range(201)]
    state["tables"]["THANH_TOAN"] = [{"ma_thanh_toan": i, "ma_donhang": ORDER, "so_tien": "0.01", "trang_thai": "THANH_CONG", "loai_giao_dich": "THU"} for i in range(101)]
    response = client.get(URL)
    assert response.status_code == 200, response.text
    assert len(response.json()["lines"]) == 201
    assert len(response.json()["payments"]) == 101
    assert response.json()["financial"]["remaining"] == "999.29"
    assert any(r.url.params.get("offset") == "200" for r in requests)


@pytest.mark.parametrize("total,collected,status,remaining", [
    ("1000.30", "0.00", "CHUA_THU", "1000.30"),
    ("1000.30", "1000.30", "DA_THU_DU", "0.00"),
    ("1000.30", "2000.00", "THU_THUA", "0.00"),
    ("9999999999999999.99", "0.01", "THU_MOT_PHAN", "9999999999999999.98"),
])
def test_balance_states_and_large_amounts(detail_client, total, collected, status, remaining):
    client, state, _ = detail_client
    state["tables"]["HOA_DON"][0]["tong_tien_sau_thue"] = total
    state["tables"]["THANH_TOAN"] = [{"ma_thanh_toan": 1, "ma_donhang": ORDER, "so_tien": collected, "trang_thai": "THANH_CONG", "loai_giao_dich": "THU"}]
    response = client.get(URL)
    assert response.status_code == 200, response.text
    assert response.json()["financial"]["payment_status"] == status
    assert response.json()["financial"]["remaining"] == remaining


def test_no_invoice_and_guest_order(detail_client):
    client, state, _ = detail_client
    state["tables"]["HOA_DON"] = []
    state["tables"]["DON_HANG"][0].update(ma_kh=None, ma_nhan_vien=None)
    response = client.get(URL)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["invoice"] is body["customer"] is body["employee"] is None
    assert body["financial"]["total"] is body["financial"]["remaining"] is None
    assert body["financial"]["payment_status"] == "CHUA_CO_HOA_DON"


@pytest.mark.parametrize("role", ["KHACH_HANG", "NHAN_VIEN"])
def test_other_roles_denied_before_data_reads(detail_client, role):
    client, state, requests = detail_client
    state["actor"] = User("OTHER", "other", role, "Other", customer_id="KH1", warehouse_id=1)
    assert client.get(URL).status_code == 403
    assert requests == []


def test_anonymous_is_unauthorized(detail_client):
    client, _, requests = detail_client
    app.dependency_overrides.pop(current_user)
    assert client.get(URL).status_code == 401
    assert requests == []


def test_missing_order_stops_before_children(detail_client):
    client, state, requests = detail_client
    state["tables"]["DON_HANG"] = []
    assert client.get(URL).status_code == 404
    assert len(requests) == 1


@pytest.mark.parametrize("kind", ["incomplete", "duplicate", "wrong_order", "refund_exceeds", "invalid_amount", "unknown_status", "two_invoices"])
def test_invalid_financial_history_never_returns_partial_totals(detail_client, kind):
    client, state, _ = detail_client
    rows = state["tables"]["THANH_TOAN"]
    if kind == "incomplete": state["bad_count"] = True
    if kind == "duplicate": rows.append(deepcopy(rows[0]))
    if kind == "wrong_order": rows[0]["ma_donhang"] = "OTHER"
    if kind == "refund_exceeds": rows[1]["so_tien"] = "500.00"
    if kind == "invalid_amount": rows[0]["so_tien"] = "NaN"
    if kind == "unknown_status": rows[0]["trang_thai"] = "UNKNOWN"
    if kind == "two_invoices": state["tables"]["HOA_DON"].append({"ma_hoadon": "HD2", "ma_donhang": ORDER})
    response = client.get(URL)
    assert response.status_code == 409, response.text
    assert "financial" not in response.json()


def test_database_failure_is_not_a_successful_empty_aggregate(detail_client):
    client, state, _ = detail_client
    state["db_error"] = True
    assert client.get(URL).status_code == 503
