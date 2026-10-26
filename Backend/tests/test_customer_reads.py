from copy import deepcopy
import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from postgrest import SyncPostgrestClient
from app.commerce.repository import CommerceRepository
from app.commerce.router import router, get_repository
from app.payments.auth import CurrentCustomer, require_customer


@pytest.fixture
def reads_client():
    order = {"ma_donhang":"ORDER-A", "ma_kh":"KH-A", "trang_thai":"HOAN_THANH", "thoi_gian_dat":"2026-10-07T10:00:00",
             "ten_nguoi_nhan":"Customer", "sdt_nguoi_nhan":"0901234567", "dia_chi_chi_tiet":"Address", "tinh_thanh":"Province", "xa_phuong":"Ward", "ghi_chu":None}
    line = {"sku":"SKU-A", "ma_kho_xuat":1, "ten_sp_luc_ban":"Product at sale", "don_vi_luc_ban":"Unit", "so_luong":3,
            "don_gia":"0.10", "giam_gia":"0.00", "giam_gia_voucher":"0.03", "tien_thue":"0.03", "thanh_tien":"0.30",
            "owned_order":{"ma_donhang":"ORDER-A", "ma_kh":"KH-A"}, "PRIVATE":"PRIVATE-DETAIL"}
    invoice = {"thoi_gian_lap":"2026-10-07T11:00:00", "tong_tien_giam":"0.03", "tong_tien_truoc_thue":"0.27", "tong_tien_thue":"0.03", "tong_tien_sau_thue":"0.30",
               "owned_order":{"ma_donhang":"ORDER-A", "ma_kh":"KH-A"}, "nguoi_lap":"PRIVATE-EMPLOYEE", "ma_so_thue":"PRIVATE-TAX", "ma_giao_dich":"PRIVATE-REFERENCE"}
    state = {"orders":[order], "lines":[line], "invoices":[invoice], "wrong_relation":False, "leak_order":False, "rpc_code":"PGRST202"}
    requests = []
    def handle(request):
        requests.append(request)
        table = request.url.path.rsplit("/",1)[-1]
        if request.method == "POST":
            assert table == "customer_read_orders_v2"
            return httpx.Response(404, json={"code":state["rpc_code"], "message":"Unavailable", "details":None, "hint":None})
        assert request.method in {"GET","HEAD"}
        if table == "DON_HANG":
            assert request.url.params["ma_kh"] == "eq.KH-A"
            data = deepcopy(state["orders"])
            identifier = request.url.params.get("ma_donhang")
            if identifier: data = [row for row in data if "eq." + row["ma_donhang"] == identifier]
            if state["leak_order"] and data: data[0]["ma_kh"] = "KH-B"
        else:
            assert table in {"CT_DON_HANG","HOA_DON"}
            assert request.url.params["owned_order.ma_kh"] == "eq.KH-A"
            assert request.url.params["ma_donhang"] == "eq.ORDER-A"
            data = deepcopy(state["lines"] if table == "CT_DON_HANG" else state["invoices"])
            if state["wrong_relation"]:
                for row in data: row["owned_order"]["ma_kh"] = "KH-B"
        count = len(data)
        offset = int(request.url.params.get("offset",0))
        limit = int(request.url.params.get("limit",500))
        data = data[offset:offset+limit]
        if request.method == "HEAD": return httpx.Response(200, headers={"content-range":f"*/{count}"})
        return httpx.Response(200, json=data, headers={"content-range":f"{offset}-{offset+len(data)-1}/{count}"})
    with httpx.Client(transport=httpx.MockTransport(handle)) as transport:
        repository = CommerceRepository(SyncPostgrestClient("https://reads.test/rest/v1", http_client=transport))
        app = FastAPI(); app.include_router(router)
        app.dependency_overrides[get_repository] = lambda: repository
        app.dependency_overrides[require_customer] = lambda: CurrentCustomer(customer_id="KH-A")
        with TestClient(app) as web: yield web, state, requests, app


def test_order_reads_work_without_rpc_with_exact_snapshots(reads_client):
    web, _, requests, _ = reads_client
    result = web.get("/api/customer/orders")
    assert result.status_code == 200 and result.json()["items"][0]["total"] == "0.30"
    assert result.json()["pagination"]["total"] == 1
    detail = web.get("/api/customer/orders/ORDER-A")
    assert detail.status_code == 200 and detail.json()["items"][0]["unit_price"] == "0.10"
    assert detail.json()["items"][0]["discount"] == "0.03"
    assert "PRIVATE" not in result.text + detail.text
    assert all(request.method != "PATCH" for request in requests)


def test_order_page_beyond_range_keeps_filtered_count(reads_client):
    web, _, _, _ = reads_client
    result = web.get("/api/customer/orders?page=5&page_size=1")
    assert result.status_code == 200 and result.json()["items"] == []
    assert result.json()["pagination"]["total"] == 1


def test_invoice_reads_existing_totals_and_filters_private_columns(reads_client):
    web, _, requests, _ = reads_client
    result = web.get("/api/customer/orders/ORDER-A/invoice")
    assert result.status_code == 200 and result.json()["invoice"]["total"] == "0.30"
    assert result.json()["items"][0]["line_total"] == "0.30"
    assert "PRIVATE" not in result.text
    select = next(request.url.params["select"] for request in requests if request.url.path.endswith("/HOA_DON"))
    assert not any(column in select for column in ["nguoi_lap", "ma_so_thue", "ma_giao_dich"])
    assert result.headers["Cache-Control"] == "no-store"


def test_invoice_absence_is_explicit_and_never_created(reads_client):
    web, state, requests, _ = reads_client
    state["invoices"] = []
    result = web.get("/api/customer/orders/ORDER-A/invoice")
    assert result.status_code == 200 and result.json()["invoice"] is None and result.json()["items"] == []
    assert all(request.method == "GET" for request in requests)


@pytest.mark.parametrize("path", ["orders/ORDER-B", "orders/ORDER-B/invoice"])
def test_foreign_and_missing_orders_share_not_found(reads_client, path):
    web, _, _, _ = reads_client
    result = web.get("/api/customer/" + path, headers={"X-Customer-Id":"KH-B"})
    assert result.status_code == 404 and result.json()["error"]["code"] == "ORDER_NOT_FOUND"


@pytest.mark.parametrize("path", ["orders", "orders/ORDER-A", "orders/ORDER-A/invoice"])
def test_order_response_rechecks_owner(reads_client, path):
    web, state, _, _ = reads_client
    state["leak_order"] = True
    assert web.get("/api/customer/" + path).status_code == 404


@pytest.mark.parametrize("path", ["orders", "orders/ORDER-A", "orders/ORDER-A/invoice"])
def test_line_or_invoice_response_cannot_leak_different_owner(reads_client, path):
    web, state, _, _ = reads_client
    state["wrong_relation"] = True
    result = web.get("/api/customer/" + path)
    assert result.status_code == 404 and "PRIVATE" not in result.text


@pytest.mark.parametrize("path", ["orders", "orders/ORDER-A", "orders/ORDER-A/invoice"])
def test_invoice_and_order_require_verified_auth_before_db(reads_client, path):
    web, _, requests, app = reads_client
    app.dependency_overrides.pop(require_customer)
    result = web.get("/api/customer/" + path)
    assert result.status_code == 503 and requests == []


def test_invoice_query_validation_and_swagger(reads_client):
    web, _, requests, _ = reads_client
    assert web.get("/api/customer/orders/ORDER-A/invoice?ma_kh=KH-B").status_code == 422
    assert requests == []
    assert "/api/customer/orders/{order_id}/invoice" in web.get("/openapi.json").json()["paths"]


def test_non_missing_rpc_errors_do_not_trigger_read_fallback(reads_client):
    web, state, requests, _ = reads_client
    state["rpc_code"] = "42501"
    assert web.get("/api/customer/orders").status_code == 500
    assert len(requests) == 1
