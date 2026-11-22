"""Product & invoice statistics (fixtures only, no database)."""
from datetime import date

import pytest
from fastapi.testclient import TestClient

from phub_api.dependencies.auth import current_user
from phub_api.dependencies.crm_analytics import get_sales_analytics_service
from phub_api.main import app
from phub_api.models.user import User
from phub_api.services.catalog_availability import available_quantities, stock_breakdown
from phub_api.services.sales_analytics import SalesAnalyticsService, continuous_periods

ADMIN = User("AD1", "admin", "ADMIN", "Admin", employee_id="NV1")
STAFF = User("NV2", "staff", "NHAN_VIEN", "Nhân viên kho", employee_id="NV2", warehouse_id=1)

ENDPOINT = "/api/crm/analytics/product-invoice-insights"


def held(order_status="MOI", invoice=True, payments=False):
    return {"trang_thai": order_status, "invoice": {"ma_donhang": "X"} if invoice else None,
            "payments": [{"ma_thanh_toan": 1}] if payments else []}


class FakeRepository:
    def __init__(self):
        self.calls = []
        self._products = [
            {"sku": "VGA", "ten_sp": "VGA RTX 4070", "ma_loai_sp": "GPU", "thuong_hieu": "ASUS", "gia_ban_hien_tai": "25000000.00", "trang_thai": 1},
            {"sku": "CPU", "ten_sp": "CPU i7", "ma_loai_sp": "CPU", "thuong_hieu": "Intel", "gia_ban_hien_tai": "8000000.00", "trang_thai": 1},
            {"sku": "RAM", "ten_sp": "RAM 32GB", "ma_loai_sp": "RAM", "thuong_hieu": None, "gia_ban_hien_tai": "900000.00", "trang_thai": 1},
            {"sku": "SSD", "ten_sp": "SSD 1TB", "ma_loai_sp": "RAM", "thuong_hieu": "Samsung", "gia_ban_hien_tai": "2000000.00", "trang_thai": 2},
            {"sku": "OLD", "ten_sp": "Hàng ẩn", "ma_loai_sp": "CPU", "thuong_hieu": None, "gia_ban_hien_tai": "1.00", "trang_thai": 0},
        ]
        self._categories = [
            {"ma_loai_sp": "GPU", "ten_loai_sp": "Card màn hình", "trang_thai": 1},
            {"ma_loai_sp": "CPU", "ten_loai_sp": "Bộ vi xử lý", "trang_thai": 1},
            {"ma_loai_sp": "RAM", "ten_loai_sp": "Bộ nhớ", "trang_thai": 1},
            {"ma_loai_sp": "OFF", "ten_loai_sp": "Ngưng", "trang_thai": 0},
        ]
        self._stock = [
            {"sku": "VGA", "ma_kho": 1, "so_luong_ton": 3},
            {"sku": "VGA", "ma_kho": 2, "so_luong_ton": 2},
            {"sku": "CPU", "ma_kho": 1, "so_luong_ton": 1},
            {"sku": "RAM", "ma_kho": 1, "so_luong_ton": 20},
        ]
        self._reservations = [
            # Held: invoice exists. Clamped to physical stock of warehouse 1.
            {"sku": "CPU", "ma_kho_xuat": 1, "so_luong": 4, "order": held()},
            {"sku": "VGA", "ma_kho_xuat": 2, "so_luong": 1, "order": held(invoice=False, payments=True)},
            # Not held: no invoice and no successful payment.
            {"sku": "RAM", "ma_kho_xuat": 1, "so_luong": 5, "order": held(invoice=False)},
        ]
        self._invoices = [
            # Paid in full, issued 2026-05-31 18:00Z = 2026-06-01 01:00 in Vietnam.
            {"ma_hoadon": "HD1", "ma_donhang": "DH1", "thoi_gian_lap": "2026-05-31T18:00:00+00:00", "nguon_lap": "TU_DONG",
             "tong_tien_giam": "0.00", "tong_tien_truoc_thue": "25000000.00", "tong_tien_thue": "2500000.00", "tong_tien_sau_thue": "27500000.00",
             "order": {"trang_thai": "HOAN_THANH", "kenh_ban": "ONLINE"}},
            # Partially paid, legacy naive local timestamp.
            {"ma_hoadon": "HD2", "ma_donhang": "DH2", "thoi_gian_lap": "2026-05-15T10:00:00", "nguon_lap": "QUAN_TRI",
             "tong_tien_giam": "500000.00", "tong_tien_truoc_thue": "7500000.00", "tong_tien_thue": "750000.00", "tong_tien_sau_thue": "8250000.00",
             "order": {"trang_thai": "XAC_NHAN", "kenh_ban": "TAI_QUAY"}},
            # Unpaid: the refund cancels the only collected amount; pending payment does not count.
            {"ma_hoadon": "HD3", "ma_donhang": "DH3", "thoi_gian_lap": "2026-05-20T10:00:00+07:00", "nguon_lap": "TU_DONG",
             "tong_tien_giam": "0.00", "tong_tien_truoc_thue": "900000.00", "tong_tien_thue": "90000.00", "tong_tien_sau_thue": "990000.00",
             "order": {"trang_thai": "MOI", "kenh_ban": "ONLINE"}},
            # Cancelled order: excluded from sales and payment status.
            {"ma_hoadon": "HD4", "ma_donhang": "DH4", "thoi_gian_lap": "2026-05-21T10:00:00+07:00", "nguon_lap": "TU_DONG",
             "tong_tien_giam": "0.00", "tong_tien_truoc_thue": "8000000.00", "tong_tien_thue": "800000.00", "tong_tien_sau_thue": "8800000.00",
             "order": {"trang_thai": "HUY", "kenh_ban": "ONLINE"}},
        ]
        self._lines = [
            {"ma_donhang": "DH1", "sku": "VGA", "ten_sp_luc_ban": "VGA RTX 4070", "so_luong": 1, "don_gia": "25000000.00", "giam_gia": "0.00", "giam_gia_voucher": "0.00"},
            {"ma_donhang": "DH2", "sku": "CPU", "ten_sp_luc_ban": "CPU i7", "so_luong": 1, "don_gia": "8000000.00", "giam_gia": "300000.00", "giam_gia_voucher": "200000.00"},
            {"ma_donhang": "DH3", "sku": "RAM", "ten_sp_luc_ban": "RAM 32GB", "so_luong": 1, "don_gia": "900000.00", "giam_gia": "0.00", "giam_gia_voucher": "0.00"},
            {"ma_donhang": "DH4", "sku": "CPU", "ten_sp_luc_ban": "CPU i7", "so_luong": 1, "don_gia": "8000000.00", "giam_gia": "0.00", "giam_gia_voucher": "0.00"},
            {"ma_donhang": "DH3", "sku": "GONE", "ten_sp_luc_ban": "Sản phẩm đã xóa", "so_luong": 2, "don_gia": "0.00", "giam_gia": "0.00", "giam_gia_voucher": "0.00"},
        ]
        self._payments = [
            {"ma_donhang": "DH1", "so_tien": "27500000.00", "loai_giao_dich": "THU", "phuong_thuc": "CHUYEN_KHOAN", "trang_thai": "THANH_CONG"},
            {"ma_donhang": "DH2", "so_tien": "3000000.00", "loai_giao_dich": "THU", "phuong_thuc": "TIEN_MAT", "trang_thai": "THANH_CONG"},
            {"ma_donhang": "DH2", "so_tien": "5250000.00", "loai_giao_dich": "THU", "phuong_thuc": "THE", "trang_thai": "THAT_BAI"},
            {"ma_donhang": "DH3", "so_tien": "990000.00", "loai_giao_dich": "THU", "phuong_thuc": "VI_DIEN_TU", "trang_thai": "THANH_CONG"},
            {"ma_donhang": "DH3", "so_tien": "990000.00", "loai_giao_dich": "HOAN_TIEN", "phuong_thuc": "VI_DIEN_TU", "trang_thai": "THANH_CONG"},
            {"ma_donhang": "DH3", "so_tien": "990000.00", "loai_giao_dich": "THU", "phuong_thuc": "CHUYEN_KHOAN", "trang_thai": "CHO_XU_LY"},
            {"ma_donhang": "DH4", "so_tien": "8800000.00", "loai_giao_dich": "THU", "phuong_thuc": "THE", "trang_thai": "THANH_CONG"},
        ]

    def products(self):
        return self._products

    def categories(self):
        return self._categories

    def stock(self, sku=None):
        return [row for row in self._stock if sku is None or row["sku"] == sku]

    def reservations(self, statuses, sku=None):
        self.calls.append(("reservations", tuple(statuses), sku))
        return [row for row in self._reservations if sku is None or row["sku"] == sku]

    def product(self, sku):
        found = next((p for p in self._products if p["sku"] == sku), None)
        if found is None:
            return None
        category = next((c for c in self._categories if c["ma_loai_sp"] == found["ma_loai_sp"]), None)
        return {**found, "category": {"ten_loai_sp": category["ten_loai_sp"]} if category else None}

    def product_sales(self, sku=None, start=None, end=None):
        """Mirrors the PostgREST query: non-cancelled orders that have an invoice; date filter is the caller's."""
        self.calls.append(("product_sales", sku, start, end))
        invoices = {inv["ma_donhang"]: inv for inv in self._invoices if inv["order"]["trang_thai"] != "HUY"}
        return [{"ma_kho_xuat": line.get("ma_kho_xuat", 1), **{k: v for k, v in line.items() if k != "ma_donhang"},
                 "order": {"ma_donhang": line["ma_donhang"], **invoices[line["ma_donhang"]]["order"],
                           "invoice": {"thoi_gian_lap": invoices[line["ma_donhang"]]["thoi_gian_lap"]}}}
                for line in self._lines if (sku is None or line["sku"] == sku) and line["ma_donhang"] in invoices]

    def invoices(self, start=None, end=None):
        """Mirrors the PostgREST embed: lines and payments live under each invoice's order."""
        self.calls.append(("invoices", start, end))
        strip = lambda row: {k: v for k, v in row.items() if k != "ma_donhang"}
        return [{**inv, "order": {**inv["order"],
                                  "lines": [strip(l) for l in self._lines if l["ma_donhang"] == inv["ma_donhang"]],
                                  "payments": [strip(p) for p in self._payments if p["ma_donhang"] == inv["ma_donhang"]]}}
                for inv in self._invoices]


@pytest.fixture(autouse=True)
def fixed_today(monkeypatch):
    """Open-ended ranges run until "today"; pin it so period lists are deterministic."""
    monkeypatch.setattr("phub_api.services.sales_analytics.vietnam_today", lambda: date(2026, 7, 10))


@pytest.fixture
def make_client():
    def _create(user=ADMIN, repo=None):
        repo = repo or FakeRepository()
        app.dependency_overrides[current_user] = lambda: user
        app.dependency_overrides[get_sales_analytics_service] = lambda: SalesAnalyticsService(repo, user)
        return TestClient(app), repo
    yield _create
    app.dependency_overrides.clear()


def test_forbidden_for_non_admin(make_client):
    client, _ = make_client(user=STAFF)
    response = client.get(ENDPOINT)
    assert response.status_code == 403
    assert "quản trị viên" in response.json()["detail"]


def test_invalid_date_range(make_client):
    client, _ = make_client()
    response = client.get(f"{ENDPOINT}?start=2026-10-10&end=2026-10-01")
    assert response.status_code == 422
    assert "Ngày bắt đầu phải trước ngày kết thúc" in response.json()["detail"]


@pytest.mark.parametrize("endpoint", [ENDPOINT, "/api/crm/analytics/product-sales?sku=VGA", "/api/crm/analytics/product-stock"])
@pytest.mark.parametrize("query", ["start=2026-07-11", "end=2026-07-11", "start=2026-07-11&end=2026-07-11"])
def test_future_report_dates_are_rejected_before_data_reads(make_client, endpoint, query):
    client, repo = make_client()
    response = client.get(endpoint + ("&" if "?" in endpoint else "?") + query)
    assert response.status_code == 422
    assert "tương lai" in response.json()["detail"]
    assert repo.calls == []


@pytest.mark.parametrize("endpoint", [ENDPOINT, "/api/crm/analytics/product-sales?sku=VGA", "/api/crm/analytics/product-stock"])
def test_today_is_a_valid_report_date(make_client, endpoint):
    client, _ = make_client()
    response = client.get(endpoint + ("&" if "?" in endpoint else "?") + "start=2026-07-10&end=2026-07-10")
    assert response.status_code == 200, response.text


def test_passes_date_range_to_reads(make_client):
    client, repo = make_client()
    response = client.get(f"{ENDPOINT}?start=2026-05-01&end=2026-06-30&period=quarter")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert ("invoices", "2026-05-01", "2026-06-30") in repo.calls
    assert ("reservations", ("MOI", "XAC_NHAN", "DANG_CHUAN_BI"), None) in repo.calls
    data = response.json()
    assert data["range"] == {"start": "2026-05-01", "end": "2026-06-30", "period_type": "quarter"}
    assert [p["label"] for p in data["timeline"]] == ["Quý 2/2026"]


def test_invoice_statistics(make_client):
    client, _ = make_client()
    data = client.get(ENDPOINT).json()

    summary = data["invoice_summary"]
    assert summary["total_invoices"] == 4
    assert summary["valid_invoices"] == 3
    assert summary["cancelled_invoices"] == 1
    assert summary["total_amount"] == "36740000.00"
    assert summary["pre_tax_amount"] == "33400000.00"
    assert summary["tax_amount"] == "3340000.00"
    assert summary["discount_amount"] == "500000.00"
    assert summary["avg_invoice_value"] == "12246666.67"
    assert summary["collected_amount"] == "30500000.00"
    assert summary["outstanding_amount"] == "6240000.00"
    assert (summary["paid_invoices"], summary["partial_invoices"], summary["unpaid_invoices"]) == (1, 1, 1)
    assert summary["items_sold"] == 5

    status = {s["key"]: s for s in data["invoice_status"]}
    assert [s["key"] for s in data["invoice_status"]] == ["PAID", "PARTIAL", "UNPAID", "CANCELLED"]
    assert status["CANCELLED"]["amount"] == "8800000.00"
    assert status["PAID"]["percentage"] == 25.0

    methods = {m["key"]: m for m in data["payment_methods"]}
    # Only successful THU rows; failed, pending and refund rows are not methods.
    assert set(methods) == {"CHUYEN_KHOAN", "TIEN_MAT", "VI_DIEN_TU"}
    assert methods["CHUYEN_KHOAN"]["label"] == "Chuyển khoản"
    assert methods["CHUYEN_KHOAN"]["amount"] == "27500000.00"

    channels = {c["key"]: c for c in data["sales_channels"]}
    assert channels["ONLINE"]["count"] == 2 and channels["TAI_QUAY"]["count"] == 1
    assert channels["ONLINE"]["label"] == "Trực tuyến"
    sources = {s["key"]: s["count"] for s in data["invoice_sources"]}
    assert sources == {"TU_DONG": 2, "QUAN_TRI": 1}

    # Vietnam timezone bucketing: HD1 at 2026-05-31T18:00Z belongs to June.
    timeline = {p["period"]: p for p in data["timeline"]}
    # Continuous from the first invoice to today (pinned to 2026-07-10): July has no invoice and shows 0.
    assert list(timeline) == ["2026-05", "2026-06", "2026-07"]
    assert (timeline["2026-07"]["invoice_count"], timeline["2026-07"]["total"]) == (0, "0.00")
    assert timeline["2026-06"]["invoice_count"] == 1 and timeline["2026-06"]["collected"] == "27500000.00"
    assert timeline["2026-05"]["invoice_count"] == 2 and timeline["2026-05"]["items_sold"] == 4


def test_product_and_stock_statistics(make_client):
    client, _ = make_client()
    data = client.get(ENDPOINT).json()

    summary = data["product_summary"]
    assert (summary["total_products"], summary["active_products"], summary["paused_products"], summary["hidden_products"]) == (4, 3, 1, 1)
    assert summary["total_categories"] == 3
    assert (summary["physical_units"], summary["held_units"], summary["available_units"]) == (26, 2, 24)
    assert summary["out_of_stock_products"] == 1  # CPU: 1 physical, fully held
    assert summary["low_stock_products"] == 1  # VGA: 4 available
    assert summary["inventory_value"] == "118000000.00"  # 4*25tr + 0*8tr + 20*0.9tr

    categories = {c["category_id"]: c for c in data["categories"]}
    assert "OFF" not in categories
    assert categories["GPU"]["revenue"] == "25000000.00" and categories["GPU"]["revenue_percentage"] == 74.9
    assert categories["CPU"]["revenue"] == "7500000.00" and categories["CPU"]["available_units"] == 0
    assert categories["KHAC"]["quantity_sold"] == 2

    top = [p["sku"] for p in data["top_products"]]
    assert top[0] == "GONE"
    assert set(top) == {"GONE", "VGA", "CPU", "RAM"}
    gone = next(p for p in data["top_products"] if p["sku"] == "GONE")
    assert gone["name"] == "Sản phẩm đã xóa" and gone["category_name"] == "Khác"
    vga = next(p for p in data["top_products"] if p["sku"] == "VGA")
    assert (vga["available_units"], vga["held_units"]) == (4, 1)

    assert data["slow_products"] == []
    assert [p["sku"] for p in data["low_stock_products"]] == ["CPU", "VGA"]

    prices = {p["label"]: p["count"] for p in data["price_ranges"]}
    assert prices == {"Dưới 1 triệu": 1, "1 - 5 triệu": 0, "5 - 10 triệu": 1, "10 - 20 triệu": 0, "Từ 20 triệu": 1}
    brands = {b["brand"]: b for b in data["top_brands"]}
    assert brands["ASUS"]["revenue"] == "25000000.00"
    assert brands["Chưa có thương hiệu"]["quantity_sold"] == 3


def test_slow_products_and_empty_range(make_client):
    repo = FakeRepository()
    repo._invoices = []
    client, _ = make_client(repo=repo)
    data = client.get(ENDPOINT).json()
    assert data["invoice_summary"]["total_invoices"] == 0
    assert data["invoice_summary"]["avg_invoice_value"] == "0.00"
    assert data["invoice_status"] == [] and data["timeline"] == [] and data["top_products"] == []
    # Active products with available stock and no sales, highest stock value first.
    assert [p["sku"] for p in data["slow_products"]] == ["VGA", "RAM"]


def test_stock_breakdown_matches_checkout_availability():
    class CatalogRepo:
        def reservations(self, values, statuses):
            return FakeRepository()._reservations

        def stock(self, values):
            return FakeRepository()._stock

    breakdown = stock_breakdown(FakeRepository()._stock, FakeRepository()._reservations)
    assert breakdown["CPU"] == {"physical": 1, "held": 1, "available": 0}
    assert breakdown["VGA"] == {"physical": 5, "held": 1, "available": 4}
    assert breakdown["RAM"] == {"physical": 20, "held": 0, "available": 20}
    assert available_quantities(CatalogRepo(), ["CPU", "VGA", "RAM", "NONE"]) == {"CPU": 0, "VGA": 4, "RAM": 20, "NONE": 0}


PRODUCT_ENDPOINT = "/api/crm/analytics/product-sales"


def test_daily_sales_group_in_vietnam_time_and_keep_empty_days(make_client):
    repo = FakeRepository()
    repo._invoices = repo._invoices[:1]  # May 31 18:00Z belongs to June 1 in Vietnam.
    client, repo = make_client(repo=repo)
    query = "period=day&start=2026-05-31&end=2026-06-02"
    response = client.get(f"{PRODUCT_ENDPOINT}?sku=VGA&{query}")
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["range"] == {"start": "2026-05-31", "end": "2026-06-02", "period_type": "day"}
    assert [(p["period"], p["quantity"], p["invoice_count"]) for p in data["timeline"]] == [
        ("2026-05-31", 0, 0), ("2026-06-01", 1, 1), ("2026-06-02", 0, 0)]
    assert data["timeline"][1]["label"] == "Ngày 01/06/2026"
    assert data["timeline"][1]["revenue"] == data["summary"]["revenue"] == "25000000.00"
    assert data["summary"]["available_units"] == 4  # Current stock does not depend on sales dates.
    assert ("product_sales", "VGA", "2026-05-31", "2026-06-02") in repo.calls
    overview = client.get(f"{ENDPOINT}?{query}")
    assert overview.status_code == 200, overview.text
    assert [(p["period"], p["invoice_count"]) for p in overview.json()["timeline"]] == [
        ("2026-05-31", 0), ("2026-06-01", 1), ("2026-06-02", 0)]


@pytest.mark.parametrize("first,last,expected", [
    (date(2024, 2, 28), date(2024, 3, 1), ["2024-02-28", "2024-02-29", "2024-03-01"]),
    (date(2026, 12, 31), date(2027, 1, 1), ["2026-12-31", "2027-01-01"]),
    (date(9999, 12, 31), date(9999, 12, 31), ["9999-12-31"]),
])
def test_daily_periods_cover_leap_day_year_boundary_and_single_day(first, last, expected):
    assert [key for key, _ in continuous_periods(first, last, "day")] == expected


def test_product_sales_requires_admin_and_valid_input(make_client):
    client, _ = make_client(user=STAFF)
    assert client.get(f"{PRODUCT_ENDPOINT}?sku=VGA").status_code == 403
    client, _ = make_client()
    assert client.get(PRODUCT_ENDPOINT).status_code == 422
    assert client.get(f"{PRODUCT_ENDPOINT}?sku=").status_code == 422
    assert client.get(f"{PRODUCT_ENDPOINT}?sku=VGA&start=2026-06-02&end=2026-06-01").status_code == 422
    response = client.get(f"{PRODUCT_ENDPOINT}?sku=KHONG-CO")
    assert response.status_code == 404
    assert response.json()["detail"] == "Không tìm thấy sản phẩm."


def test_product_sales_fills_every_period_and_matches_stock_rule(make_client):
    repo = FakeRepository()
    repo._invoices.append({
        "ma_hoadon": "HD5", "ma_donhang": "DH5", "thoi_gian_lap": "2026-03-10T10:00:00+07:00", "nguon_lap": "QUAN_TRI",
        "tong_tien_giam": "0.00", "tong_tien_truoc_thue": "48000000.00", "tong_tien_thue": "0.00", "tong_tien_sau_thue": "48000000.00",
        "order": {"trang_thai": "HOAN_THANH", "kenh_ban": "TAI_QUAY"}})
    repo._lines.append({"ma_donhang": "DH5", "sku": "VGA", "ma_kho_xuat": 9, "ten_sp_luc_ban": "VGA RTX 4070", "so_luong": 2,
                        "don_gia": "25000000.00", "giam_gia": "2000000.00", "giam_gia_voucher": "0.00"})
    client, repo = make_client(repo=repo)
    response = client.get(f"{PRODUCT_ENDPOINT}?sku=VGA&start=2026-02-01&end=2026-07-10&period=month")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert ("product_sales", "VGA", "2026-02-01", "2026-07-10") in repo.calls
    assert ("reservations", ("MOI", "XAC_NHAN", "DANG_CHUAN_BI"), "VGA") in repo.calls
    data = response.json()
    assert (data["name"], data["category_name"], data["brand"], data["price"], data["status"]) == ("VGA RTX 4070", "Card màn hình", "ASUS", "25000000.00", 1)
    # Every month from the requested start to end, including months without sales.
    assert [p["period"] for p in data["timeline"]] == ["2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07"]
    quantities = {p["period"]: p["quantity"] for p in data["timeline"]}
    assert quantities == {"2026-02": 0, "2026-03": 2, "2026-04": 0, "2026-05": 0, "2026-06": 1, "2026-07": 0}
    march = next(p for p in data["timeline"] if p["period"] == "2026-03")
    assert (march["label"], march["revenue"], march["invoice_count"]) == ("Tháng 03/2026", "48000000.00", 1)
    summary = data["summary"]
    assert (summary["quantity_sold"], summary["revenue"], summary["invoice_count"], summary["avg_unit_price"]) == (3, "73000000.00", 2, "24333333.33")
    assert (summary["physical_units"], summary["held_units"], summary["available_units"]) == (5, 1, 4)
    assert {c["key"]: c["quantity"] for c in data["channels"]} == {"ONLINE": 1, "TAI_QUAY": 2}
    warehouses = {w["warehouse_id"]: w for w in data["warehouses"]}
    assert (warehouses[2]["held_units"], warehouses[2]["available_units"]) == (1, 1)
    assert warehouses[1]["quantity_sold"] == 1
    # Sold from a warehouse that is no longer active: listed with zero stock.
    assert (warehouses[9]["quantity_sold"], warehouses[9]["available_units"]) == (2, 0)
    assert "không hoạt động" in warehouses[9]["name"]


def test_product_sales_quarters_and_cancelled_orders(make_client, monkeypatch):
    monkeypatch.setattr("phub_api.services.sales_analytics.vietnam_today", lambda: date(2026, 12, 31))
    client, _ = make_client()
    data = client.get(f"{PRODUCT_ENDPOINT}?sku=CPU&start=2026-01-01&end=2026-12-31&period=quarter").json()
    # The cancelled DH4 line for CPU is not counted; DH2 is.
    assert [(p["label"], p["quantity"]) for p in data["timeline"]] == [("Quý 1/2026", 0), ("Quý 2/2026", 1), ("Quý 3/2026", 0), ("Quý 4/2026", 0)]
    assert data["summary"]["revenue"] == "7500000.00"
    assert data["summary"]["available_units"] == 0


def test_product_sales_for_sku_missing_from_catalog_and_unsold_product(make_client):
    client, _ = make_client()
    gone = client.get(f"{PRODUCT_ENDPOINT}?sku=GONE&period=year").json()
    assert (gone["name"], gone["category_name"], gone["price"], gone["status"]) == ("Sản phẩm đã xóa", "Khác", None, None)
    assert gone["timeline"][0]["period"] == "2026" and gone["summary"]["quantity_sold"] == 2
    unsold = client.get(f"{PRODUCT_ENDPOINT}?sku=SSD").json()
    assert unsold["timeline"] == [] and unsold["summary"]["quantity_sold"] == 0 and unsold["warehouses"] == []


STOCK_ENDPOINT = "/api/crm/analytics/product-stock"


def test_product_stock_requires_admin_and_valid_params(make_client):
    client, _ = make_client(user=STAFF)
    assert client.get(STOCK_ENDPOINT).status_code == 403
    client, _ = make_client()
    for query in ("view=other", "status=SOLD", "page=0", "page_size=101", "start=2026-02-02&end=2026-02-01"):
        assert client.get(f"{STOCK_ENDPOINT}?{query}").status_code == 422, query


def test_product_stock_views_match_summary_tiles(make_client):
    client, repo = make_client()
    summary = client.get(ENDPOINT).json()["product_summary"]

    products = client.get(STOCK_ENDPOINT).json()
    assert products["view"] == "products" and products["status"] == "ACTIVE"
    assert products["total"] == summary["active_products"] == 3
    assert [i["sku"] for i in products["items"]] == ["CPU", "RAM", "VGA"]  # by name
    assert products["totals"]["inventory_value"] == summary["inventory_value"]
    assert [c["category_id"] for c in products["categories"]] == ["RAM", "CPU", "GPU"]  # active, sorted by name without accents
    assert ("product_sales", None, None, None) in repo.calls

    # The "Tồn khả dụng" tile counts every product's stock, so the list uses status=ALL.
    stock = client.get(f"{STOCK_ENDPOINT}?view=stock&status=ALL").json()
    assert (stock["totals"]["physical_units"], stock["totals"]["held_units"], stock["totals"]["available_units"]) == (
        summary["physical_units"], summary["held_units"], summary["available_units"])
    assert [i["sku"] for i in stock["items"]][:3] == ["RAM", "VGA", "CPU"]
    warehouses = {w["warehouse_id"]: w for w in stock["warehouses"]}
    assert (warehouses[1]["physical_units"], warehouses[1]["held_units"], warehouses[1]["available_units"]) == (24, 1, 23)
    assert (warehouses[2]["held_units"], warehouses[2]["available_units"]) == (1, 1)

    low = client.get(f"{STOCK_ENDPOINT}?view=low").json()
    assert low["total"] == summary["out_of_stock_products"] + summary["low_stock_products"]
    assert [(i["sku"], i["available_units"], i["held_units"], i["quantity_sold"]) for i in low["items"]] == [("CPU", 0, 1, 1), ("VGA", 4, 1, 1)]

    value = client.get(f"{STOCK_ENDPOINT}?view=value").json()
    assert [(i["sku"], i["inventory_value"], i["value_percentage"]) for i in value["items"]] == [
        ("VGA", "100000000.00", 84.7), ("RAM", "18000000.00", 15.3), ("CPU", "0.00", 0.0)]


def test_product_stock_filters_search_and_pages(make_client):
    client, repo = make_client()
    repo._products.append({"sku": "VGA-2", "ten_sp": "Card đồ họa Điện Quang", "ma_loai_sp": "GPU", "thuong_hieu": None,
                           "gia_ban_hien_tai": "100.00", "trang_thai": 1})
    # Accent- and case-insensitive search over name and SKU.
    assert [i["sku"] for i in client.get(f"{STOCK_ENDPOINT}?q=dien quang").json()["items"]] == ["VGA-2"]
    assert [i["sku"] for i in client.get(f"{STOCK_ENDPOINT}?q=%20vga%20").json()["items"]] == ["VGA-2", "VGA"]
    assert client.get(f"{STOCK_ENDPOINT}?q=%20%20").json()["q"] is None
    gpu = client.get(f"{STOCK_ENDPOINT}?category=GPU").json()
    assert gpu["total"] == 2 and {i["category_name"] for i in gpu["items"]} == {"Card màn hình"}
    assert [i["sku"] for i in client.get(f"{STOCK_ENDPOINT}?status=PAUSED").json()["items"]] == ["SSD"]
    assert [i["sku"] for i in client.get(f"{STOCK_ENDPOINT}?status=HIDDEN").json()["items"]] == ["OLD"]
    assert client.get(f"{STOCK_ENDPOINT}?status=ALL").json()["total"] == 6
    page = client.get(f"{STOCK_ENDPOINT}?status=ALL&page=2&page_size=4").json()
    assert (page["total"], page["page"], len(page["items"])) == (6, 2, 2)
    # Totals cover every matching product, not only the current page.
    assert page["totals"]["products"] == 6
    beyond = client.get(f"{STOCK_ENDPOINT}?page=9").json()
    assert beyond["items"] == [] and beyond["total"] == 4
    ranged = client.get(f"{STOCK_ENDPOINT}?start=2026-06-01&end=2026-06-30").json()
    assert ("product_sales", None, "2026-06-01", "2026-06-30") in repo.calls
    assert (ranged["start"], ranged["end"]) == ("2026-06-01", "2026-06-30")


def test_product_stock_sales_view_searches_every_product_by_sales(make_client):
    client, _ = make_client()
    data = client.get(f"{STOCK_ENDPOINT}?view=sales&status=ALL").json()
    # Sold first (quantity, then revenue), unsold products still searchable afterwards.
    assert [(i["sku"], i["quantity_sold"], i["revenue"]) for i in data["items"]][:3] == [
        ("VGA", 1, "25000000.00"), ("CPU", 1, "7500000.00"), ("RAM", 1, "900000.00")]
    assert {i["sku"] for i in data["items"][3:]} == {"SSD", "OLD"}
    found = client.get(f"{STOCK_ENDPOINT}?view=sales&status=ALL&q=ram").json()
    assert [(i["sku"], i["revenue"]) for i in found["items"]] == [("RAM", "900000.00")]


def test_price_ranges_and_brands_carry_matching_category_breakdowns(make_client):
    client, _ = make_client()
    data = client.get(ENDPOINT).json()
    ranges = {r["key"]: r for r in data["price_ranges"]}
    assert list(ranges) == ["LT_1M", "1M_5M", "5M_10M", "10M_20M", "GTE_20M"]
    for row in ranges.values():
        # The breakdown adds up to the row: products on sale in that price range.
        assert sum(c["product_count"] for c in row["categories"]) == row["count"]
    assert [(c["category_id"], c["quantity_sold"], c["revenue"], c["revenue_percentage"]) for c in ranges["GTE_20M"]["categories"]] == [
        ("GPU", 1, "25000000.00", 100.0)]
    assert ranges["1M_5M"]["categories"] == []
    assert [(c["category_id"], c["available_units"], c["inventory_value"]) for c in ranges["LT_1M"]["categories"]] == [("RAM", 20, "18000000.00")]

    brands = {b["brand"]: b for b in data["top_brands"]}
    for brand in brands.values():
        assert sum(c["quantity_sold"] for c in brand["categories"]) == brand["quantity_sold"]
        assert sum(float(c["revenue"]) for c in brand["categories"]) == float(brand["revenue"])
        assert sum(c["product_count"] for c in brand["categories"]) == brand["product_count"]
    # A sold SKU missing from the catalog counts under "Chưa có thương hiệu" / "Khác", like the brand row.
    no_brand = {c["category_id"]: c for c in brands["Chưa có thương hiệu"]["categories"]}
    assert (no_brand["KHAC"]["quantity_sold"], no_brand["RAM"]["product_count"]) == (2, 1)
