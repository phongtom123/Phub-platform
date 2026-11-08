from datetime import date
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient

from phub_api.dependencies.auth import current_user
from phub_api.main import app
from phub_api.models.user import User
from phub_api.services.crm_analytics import CrmAnalyticsService

ADMIN = User("AD1", "admin", "ADMIN", "Admin", employee_id="NV1")
STAFF = User("NV2", "staff", "NHAN_VIEN", "Nhân viên kho", employee_id="NV2", warehouse_id=1)


class FakeRepository:
    def __init__(self, customers=None, orders=None, lines=None, products=None, categories=None, surveys=None, responses=None):
        self._customers = customers if customers is not None else [
            {"ma_kh": "KH1", "ten_kh": "Nguyễn Văn A", "gioi_tinh": "NAM", "ngay_sinh": "2002-05-15", "so_thich": "Gaming, Đồ họa"},
            {"ma_kh": "KH2", "ten_kh": "Trần Thị B", "gioi_tinh": "NU", "ngay_sinh": "1995-10-20", "so_thich": "Văn phòng"},
            {"ma_kh": "KH3", "ten_kh": "Lê Văn C", "gioi_tinh": "KHAC", "ngay_sinh": "1980-03-01", "so_thich": None},
            {"ma_kh": "KH4", "ten_kh": "Phạm D", "gioi_tinh": None, "ngay_sinh": None, "so_thich": None},
        ]
        self._orders = orders if orders is not None else [
            {"ma_donhang": "DH1", "ma_kh": "KH1", "thoi_gian_dat": "2026-05-10T10:00:00+07:00", "trang_thai": "HOAN_THANH", "tong_tien": "25000000.00", "tinh_thanh": "TP. Hồ Chí Minh"},
            {"ma_donhang": "DH2", "ma_kh": "KH2", "thoi_gian_dat": "2026-05-15T14:30:00+07:00", "trang_thai": "HOAN_THANH", "tong_tien": "8000000.00", "tinh_thanh": "TP. Hà Nội"},
            {"ma_donhang": "DH3", "ma_kh": "KH1", "thoi_gian_dat": "2026-06-01T09:00:00+07:00", "trang_thai": "HOAN_THANH", "tong_tien": "2000000.00", "tinh_thanh": "TP. Hồ Chí Minh"},
        ]
        self._lines = lines if lines is not None else [
            {"ma_donhang": "DH1", "sku": "SKU-VGA-4070", "so_luong": 1, "don_gia": "25000000.00", "giam_gia": "0.00", "giam_gia_voucher": "0.00"},
            {"ma_donhang": "DH2", "sku": "SKU-CPU-I7", "so_luong": 1, "don_gia": "8000000.00", "giam_gia": "0.00", "giam_gia_voucher": "0.00"},
            {"ma_donhang": "DH3", "sku": "SKU-RAM-32G", "so_luong": 1, "don_gia": "2000000.00", "giam_gia": "0.00", "giam_gia_voucher": "0.00"},
        ]
        self._products = products if products is not None else [
            {"sku": "SKU-VGA-4070", "ten_sp": "VGA ASUS RTX 4070", "ma_loai_sp": "VGA"},
            {"sku": "SKU-CPU-I7", "ten_sp": "CPU Intel Core i7 14700K", "ma_loai_sp": "CPU"},
            {"sku": "SKU-RAM-32G", "ten_sp": "RAM Corsair 32GB DDR5", "ma_loai_sp": "RAM"},
        ]
        self._categories = categories if categories is not None else [
            {"ma_loai_sp": "VGA", "ten_loai_sp": "Card màn hình"},
            {"ma_loai_sp": "CPU", "ten_loai_sp": "Bộ vi xử lý"},
            {"ma_loai_sp": "RAM", "ten_loai_sp": "Bộ nhớ trong"},
        ]
        self._surveys = surveys if surveys is not None else [
            {"ma_khao_sat": "surv-1", "tieu_de": "Khảo sát dịch vụ", "trang_thai": "DANG_MO"}
        ]
        self._survey_responses = responses if responses is not None else [
            {"ma_bai_nop": "resp-1", "ma_khao_sat": "surv-1", "ten_nguoi_gui": "Nguyễn Văn A", "answers": [{"loai_cau_hoi": "DIEM_1_5", "nhom_noi_dung": "HAI_LONG", "diem": 5, "noi_dung": "Rất hài lòng"}], "ngay_gui": "2026-05-12T10:00:00Z"},
            {"ma_bai_nop": "resp-2", "ma_khao_sat": "surv-1", "ten_nguoi_gui": "Trần Thị B", "answers": [{"loai_cau_hoi": "DIEM_1_5", "nhom_noi_dung": "HAI_LONG", "diem": 4, "noi_dung": "Hàng đẹp"}], "ngay_gui": "2026-05-16T14:00:00Z"},
        ]

    def customers(self):
        return self._customers

    def completed_orders(self, start=None, end=None, status_scope="ACTIVE"):
        return self._orders

    def order_lines(self, order_ids=None):
        return self._lines

    def products(self):
        return self._products

    def categories(self):
        return self._categories

    def surveys(self):
        return self._surveys

    def survey_responses(self):
        return self._survey_responses


@pytest.fixture
def make_client():
    def _create(user=ADMIN, repo=None):
        fake_repo = repo or FakeRepository()
        app.dependency_overrides[current_user] = lambda: user
        from phub_api.dependencies.crm_analytics import get_analytics_service
        app.dependency_overrides[get_analytics_service] = lambda: CrmAnalyticsService(fake_repo, user)
        client = TestClient(app)
        return client
    yield _create
    app.dependency_overrides.clear()


def test_customer_insights_forbidden_for_non_admin(make_client):
    client = make_client(user=STAFF)
    response = client.get("/api/crm/analytics/customer-insights")
    assert response.status_code == 403
    assert "quản trị viên" in response.json()["detail"]


def test_customer_insights_invalid_date_range(make_client):
    client = make_client(user=ADMIN)
    response = client.get("/api/crm/analytics/customer-insights?start=2026-10-10&end=2026-10-01")
    assert response.status_code == 422
    assert "Ngày bắt đầu phải trước ngày kết thúc" in response.json()["detail"]


def test_customer_insights_success_calculation(make_client):
    client = make_client(user=ADMIN)
    response = client.get("/api/crm/analytics/customer-insights?period=month")
    assert response.status_code == 200
    data = response.json()

    # Summary
    summary = data["summary"]
    assert summary["total_customers"] == 4
    assert summary["active_buyers"] == 2  # KH1 and KH2
    assert summary["total_orders"] == 3
    assert summary["total_revenue"] == "35000000.00"

    # Demographics
    demographics = data["demographics"]
    genders = {g["label"]: g["value"] for g in demographics["gender"]}
    assert genders["Nam"] == 1
    assert genders["Nữ"] == 1
    assert genders["Khác"] == 1
    assert genders["Chưa xác định"] == 1

    # Age groups
    age_groups = {ag["group"]: ag["value"] for ag in demographics["age_groups"]}
    assert age_groups["Chưa có ngày sinh"] == 1

    # By age group cross-dimension
    assert "by_age_group" in demographics
    by_age = {item["group"]: item for item in demographics["by_age_group"]}
    assert "Tất cả" in by_age
    assert by_age["Tất cả"]["customer_count"] == 4
    assert len(by_age["Tất cả"]["gender"]) == 4

    # By gender cross-dimension & Category Matrix
    assert "by_gender" in demographics
    by_g = {item["label"]: item for item in demographics["by_gender"]}
    assert "Tất cả" in by_g
    assert "Nam" in by_g
    assert "Nữ" in by_g
    assert by_g["Nam"]["customer_count"] == 1
    assert by_g["Nam"]["total_orders"] == 2
    assert len(by_g["Nam"]["top_categories"]) >= 1

    assert "gender_category_matrix" in demographics
    matrix = demographics["gender_category_matrix"]
    assert len(matrix) >= 1
    vga_row = next((m for m in matrix if m["category_name"] == "Card màn hình"), None)
    assert vga_row is not None
    assert vga_row["nam_quantity"] == 1
    assert vga_row["nu_quantity"] == 0

    # Spending trends
    trends = data["spending_trends"]
    assert trends["period_type"] == "month"
    assert len(trends["timeline"]) == 2  # May 2026 and June 2026
    
    segments = {s["segment"]: s["count"] for s in trends["customer_segments"]}
    # KH1 has 27m (VIP), KH2 has 8m (Potential)
    assert any("VIP" in k and v == 1 for k, v in segments.items())
    assert any("Tiềm năng" in k and v == 1 for k, v in segments.items())

    # Products & Categories
    product_insights = data["product_insights"]
    assert len(product_insights["top_categories"]) >= 3
    top_cat = product_insights["top_categories"][0]
    assert top_cat["category_name"] == "Card màn hình"

    # Strategic recommendations
    assert len(data["strategic_recommendations"]) > 0

    # Geographic city distribution
    cities = data["city_distribution"]
    assert len(cities) >= 2
    city_map = {c["city"]: c for c in cities}
    assert "TP. Hồ Chí Minh" in city_map
    assert city_map["TP. Hồ Chí Minh"]["order_count"] == 2
    assert "TP. Hà Nội" in city_map
    assert city_map["TP. Hà Nội"]["order_count"] == 1

    # Surveys & CSAT Insights
    surveys_data = data["survey_insights"]
    assert surveys_data["total_surveys"] == 1
    assert surveys_data["total_responses"] == 2
    assert surveys_data["avg_overall_score"] == 4.5
    assert len(surveys_data["rating_breakdown"]) == 5
    assert len(surveys_data["recent_feedbacks"]) == 2


def test_customer_insights_empty_dataset(make_client):
    empty_repo = FakeRepository(customers=[], orders=[], lines=[], products=[], categories=[], surveys=[], responses=[])
    client = make_client(user=ADMIN, repo=empty_repo)
    response = client.get("/api/crm/analytics/customer-insights")
    assert response.status_code == 200
    data = response.json()
    assert data["summary"]["total_customers"] == 0
    assert data["summary"]["total_orders"] == 0
    assert data["summary"]["total_revenue"] == "0.00"
    assert data["survey_insights"]["total_responses"] == 0
    assert data["survey_insights"]["total_surveys"] == 0
    assert len(data["survey_insights"]["recent_feedbacks"]) == 0
    assert len(data["strategic_recommendations"]) > 0


def test_survey_text_only_does_not_get_assigned_five_stars(make_client):
    """Bug fix verification: open-ended text answers must not be defaulted to 5/5 stars."""
    text_only_repo = FakeRepository(
        surveys=[{"ma_khao_sat": "surv-text", "tieu_de": "Khảo sát ý kiến"}],
        responses=[
            {
                "ma_bai_nop": "resp-txt-1",
                "ma_khao_sat": "surv-text",
                "ten_nguoi_gui": "Khách ẩn danh",
                "diem_san_pham": None,
                "diem_dich_vu": None,
                "diem_tong_the": None,
                "y_kien_dong_gop": "Chất lượng cần cải thiện",
                "answers": [{"loai_cau_hoi": "VAN_BAN", "nhom_noi_dung": "CHUNG", "noi_dung": "Chất lượng cần cải thiện"}],
                "ngay_gui": "2026-05-18T10:00:00Z",
            }
        ],
    )
    client = make_client(user=ADMIN, repo=text_only_repo)
    response = client.get("/api/crm/analytics/customer-insights")
    assert response.status_code == 200
    data = response.json()
    si = data["survey_insights"]
    assert si["total_responses"] == 1
    assert si["avg_overall_score"] is None
    assert si["avg_product_score"] is None
    assert si["avg_service_score"] is None
    # All star count buckets should be 0 because there were no rated responses
    assert all(b["count"] == 0 for b in si["rating_breakdown"])
    # Recent feedbacks show overall_score as None
    assert si["recent_feedbacks"][0]["overall_score"] is None
    assert si["recent_feedbacks"][0]["comment"] == "Chất lượng cần cải thiện"


def test_timeline_groups_use_order_date_for_active_and_completion_date_for_completed(make_client):
    """Bug fix verification: timeline grouping aligns with the query filter."""
    orders = [
        {
            "ma_donhang": "DH-CROSS-MONTH",
            "ma_kh": "KH1",
            "thoi_gian_dat": "2026-05-30T10:00:00+07:00",
            "thoi_gian_hoan_thanh": "2026-06-02T10:00:00+07:00",
            "trang_thai": "HOAN_THANH",
            "tong_tien": "5000000.00",
            "tinh_thanh": "TP. Hồ Chí Minh",
        }
    ]
    lines = [
        {"ma_donhang": "DH-CROSS-MONTH", "sku": "SKU-CPU-I7", "so_luong": 1, "don_gia": "5000000.00", "giam_gia": "0.00", "giam_gia_voucher": "0.00"}
    ]
    repo = FakeRepository(orders=orders, lines=lines)
    client = make_client(user=ADMIN, repo=repo)

    # ACTIVE scope uses order date (May 2026)
    res_active = client.get("/api/crm/analytics/customer-insights?status_scope=ACTIVE")
    assert res_active.status_code == 200
    timeline_active = res_active.json()["spending_trends"]["timeline"]
    assert len(timeline_active) == 1
    assert timeline_active[0]["period"] == "2026-05"

    # COMPLETED scope uses completion date (June 2026)
    res_completed = client.get("/api/crm/analytics/customer-insights?status_scope=COMPLETED")
    assert res_completed.status_code == 200
    timeline_completed = res_completed.json()["spending_trends"]["timeline"]
    assert len(timeline_completed) == 1
    assert timeline_completed[0]["period"] == "2026-06"


def test_age_group_with_no_orders_produces_empty_sub_metrics(make_client):
    """Bug fix verification: age group with 0 orders must not inherit global data."""
    # KH-YOUNG is born in 2012 (age 14 in 2026 -> Dưới 18), but has no orders
    customers = [
        {"ma_kh": "KH-YOUNG", "ten_kh": "Trẻ tuổi", "gioi_tinh": "NAM", "ngay_sinh": "2012-01-01", "so_thich": None},
    ]
    repo = FakeRepository(customers=customers, orders=[], lines=[])
    client = make_client(user=ADMIN, repo=repo)
    response = client.get("/api/crm/analytics/customer-insights")
    assert response.status_code == 200
    data = response.json()
    by_age = data["demographics"]["by_age_group"]
    group_u18 = next(ag for ag in by_age if ag["group"] == "Dưới 18")
    assert group_u18["customer_count"] == 1
    assert group_u18["total_orders"] == 0
    assert group_u18["revenue"] == "0.00"
    assert group_u18["top_categories"] == []
    assert group_u18["top_products"] == []
    assert group_u18["gender_category_matrix"] == []


def test_repository_surveys_raises_on_connection_error():
    """Bug fix verification: connection errors are not swallowed as fake empty data."""
    from phub_api.repositories.crm_analytics import CrmAnalyticsRepository

    class FailingDb:
        def table(self, name):
            raise ConnectionError("Không thể kết nối Supabase")

    repo = CrmAnalyticsRepository(FailingDb())
    with pytest.raises(ConnectionError):
        repo.surveys()


def test_repository_returns_submitted_answers_without_inferred_scores():
    """Repository joins actual answers; the service owns CSAT calculations."""
    from types import SimpleNamespace
    from phub_api.repositories.crm_analytics import CrmAnalyticsRepository

    class MockQueryBuilder:
        def __init__(self, data):
            self._data = data

        def select(self, *args, **kwargs):
            return self

        def range(self, *args, **kwargs):
            return self

        def order(self, *args, **kwargs):
            return self

        def execute(self):
            return SimpleNamespace(data=self._data)

    class MockDb:
        def table(self, name):
            if name == "TRA_LOI_KHAO_SAT":
                return MockQueryBuilder([
                    # Sub 1: 2 questions with scores 5 and 3
                    {"ma_gui": "g-1", "ma_khao_sat": "s-1", "ma_cau_hoi": "q-prod", "diem": 5, "noi_dung": None},
                    {"ma_gui": "g-1", "ma_khao_sat": "s-1", "ma_cau_hoi": "q-serv", "diem": 3, "noi_dung": None},
                    # Sub 2: text only
                    {"ma_gui": "g-2", "ma_khao_sat": "s-1", "ma_cau_hoi": "q-text", "diem": None, "noi_dung": "Góp ý"},
                ])
            elif name == "GUI_KHAO_SAT":
                return MockQueryBuilder([
                    {"ma_gui": "g-1", "ma_kh": "KH1", "hoan_thanh_luc": "2026-05-10T00:00:00Z"},
                    {"ma_gui": "g-2", "ma_kh": "KH2", "hoan_thanh_luc": "2026-05-11T00:00:00Z"},
                ])
            elif name == "KHACH_HANG":
                return MockQueryBuilder([
                    {"ma_kh": "KH1", "ten_kh": "Nguyễn A"},
                    {"ma_kh": "KH2", "ten_kh": "Trần B"},
                ])
            elif name == "CAU_HOI_KHAO_SAT":
                return MockQueryBuilder([
                    {"ma_cau_hoi": "q-prod", "loai_cau_hoi": "DIEM_1_5", "nhom_noi_dung": "HAI_LONG"},
                    {"ma_cau_hoi": "q-serv", "loai_cau_hoi": "DIEM_1_5", "nhom_noi_dung": "HAI_LONG"},
                    {"ma_cau_hoi": "q-text", "loai_cau_hoi": "VAN_BAN", "nhom_noi_dung": "CHUNG"},
                ])
            return MockQueryBuilder([])

    repo = CrmAnalyticsRepository(MockDb())
    subs = repo.survey_responses()
    assert len(subs) == 2

    sub1 = next(s for s in subs if s["ma_bai_nop"] == "g-1")
    assert [a["diem"] for a in sub1["answers"]] == [5, 3]
    assert all(a["nhom_noi_dung"] == "HAI_LONG" for a in sub1["answers"])
    assert "diem_dich_vu" not in sub1

    # Sub 2 has text only -> no scores
    sub2 = next(s for s in subs if s["ma_bai_nop"] == "g-2")
    assert sub2["answers"][0]["diem"] is None
    assert sub2["answers"][0]["noi_dung"] == "Góp ý"



