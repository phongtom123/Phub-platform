"""CRM report regressions; all database traffic uses MockTransport."""
import httpx
import pytest
from postgrest import SyncPostgrestClient
from postgrest.exceptions import APIError

from phub_api.repositories.crm_analytics import CrmAnalyticsRepository
from phub_api.schemas.crm_analytics import CustomerInsightsReport
from phub_api.services.crm_analytics import CrmAnalyticsService
from phub_api.services.crm_survey_metrics import survey_insights
from test_crm_analytics import ADMIN, FakeRepository


def rated(score, group="HAI_LONG", kind="DIEM_1_5"):
    return {"diem": score, "nhom_noi_dung": group, "loai_cau_hoi": kind}


def test_satisfaction_mean_preserves_halves_and_histogram_counts_real_answers():
    responses = [{"ma_bai_nop": "R1", "ngay_gui": "2026-11-08T00:00:00Z", "answers": [rated(5), rated(4)]},
                 {"ma_bai_nop": "R2", "answers": [rated(1, "SO_THICH"), rated(2, "CHUNG")]},
                 {"ma_bai_nop": "R3", "answers": []}]
    report = CrmAnalyticsService(FakeRepository(responses=responses), ADMIN).customer_insights()
    # Verify the public response model also preserves 4.5 instead of coercing it to int.
    result = CustomerInsightsReport.model_validate(report).survey_insights
    assert result.avg_overall_score == 4.5
    assert result.total_responses == 3
    assert result.rated_responses == 1
    assert result.total_ratings == 2
    assert result.avg_product_score is None and result.avg_service_score is None
    assert result.recent_feedbacks[0].overall_score == 4.5
    assert result.recent_feedbacks[0].product_score is None
    assert result.recent_feedbacks[0].service_score is None
    histogram = {b.stars: (b.count, b.percentage) for b in result.rating_breakdown}
    assert histogram == {5: (1, 50.0), 4: (1, 50.0), 3: (0, 0.0), 2: (0, 0.0), 1: (0, 0.0)}


def test_global_average_uses_actual_answers_without_intermediate_rounding():
    result = survey_insights([], [{"answers": [rated(5), rated(4), rated(4)]},
                                  {"answers": [rated(1)]}])
    assert result["avg_overall_score"] == 3.5
    assert sum(item["count"] for item in result["rating_breakdown"]) == 4
    # Question text/keywords and old precomputed fields cannot create component scores.
    result = survey_insights([], [{"diem_dich_vu": 5, "answers": [dict(rated(5), noi_dung="dịch vụ sản phẩm")]}])
    assert result["avg_overall_score"] == 5.0
    assert result["avg_product_score"] is None and result["avg_service_score"] is None


def test_non_satisfaction_questions_do_not_create_csat_or_recommendation():
    responses = [{"answers": [rated(5, "SO_THICH"), rated(5, "CHUNG"), rated(None)]}]
    report = CrmAnalyticsService(FakeRepository(responses=responses), ADMIN).customer_insights()
    assert report["survey_insights"]["avg_overall_score"] is None
    assert report["survey_insights"]["total_ratings"] == 0
    assert not any(item["type"] == "CSAT_EXCELLENCE" for item in report["strategic_recommendations"])


@pytest.mark.parametrize("score", [0, 6, True, "5"])
def test_bad_satisfaction_data_is_an_error_instead_of_a_replacement_score(score):
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as error:
        survey_insights([], [{"answers": [rated(score)]}])
    assert error.value.status_code == 502


@pytest.mark.parametrize("scope", ["ACTIVE", "COMPLETED"])
@pytest.mark.parametrize("period,expected", [("month", "2027-01"), ("quarter", "2027-Q1"), ("year", "2027")])
def test_periods_use_vietnam_time_across_year_boundary(scope, period, expected):
    field = "thoi_gian_dat" if scope == "ACTIVE" else "thoi_gian_hoan_thanh"
    order = {"ma_donhang": "D1", "ma_kh": "KH1", "thoi_gian_dat": "2025-06-01T00:00:00+07:00",
             "thoi_gian_hoan_thanh": "2025-07-01T00:00:00+07:00", field: "2026-12-31T18:00:00Z"}
    report = CrmAnalyticsService(FakeRepository(orders=[order], lines=[]), ADMIN).customer_insights(period=period, status_scope=scope)
    assert report["spending_trends"]["timeline"][0]["period"] == expected


@pytest.mark.parametrize("timestamp", ["2026-11-01T01:00:00", "2026-11-01T01:00:00+07:00", "2026-10-31T18:00:00Z"])
def test_naive_legacy_time_is_local_vietnam_time(timestamp):
    order = {"ma_donhang": "D1", "ma_kh": "KH1", "thoi_gian_dat": timestamp}
    report = CrmAnalyticsService(FakeRepository(orders=[order], lines=[]), ADMIN).customer_insights()
    assert report["spending_trends"]["timeline"][0]["period"] == "2026-11"


@pytest.mark.parametrize("method,table,key", [
    ("customers", "KHACH_HANG", "ma_kh"), ("products", "SAN_PHAM", "sku"),
    ("categories", "LOAI_SP", "ma_loai_sp"), ("surveys", "KHAO_SAT", "ma_khao_sat"),
    ("order_lines", "CT_DON_HANG", "ma_ct_donhang"),
    ("completed_orders", "DON_HANG", "ma_donhang"),
])
def test_report_reads_all_pages_in_unique_key_order(method, table, key):
    records = [{key: str(i)} for i in range(1001)]
    offsets = []

    def handle(request):
        if request.url.path.split("/")[-1] != table:
            assert request.url.params["order"] == "ma_ct_donhang.asc"
            return httpx.Response(200, json=[])
        assert request.url.params["order"] == key + ".asc"
        offset, limit = int(request.url.params["offset"]), int(request.url.params["limit"])
        offsets.append(offset)
        return httpx.Response(200, json=records[offset:offset+limit])

    with httpx.Client(transport=httpx.MockTransport(handle)) as client:
        repo = CrmAnalyticsRepository(SyncPostgrestClient("https://fixture.test/rest/v1", http_client=client))
        result = getattr(repo, method)()
    assert offsets == [0, 500, 1000]
    assert [item[key] for item in result] == [str(i) for i in range(1001)]


def test_chunked_order_lines_paginate_every_chunk_and_include_end_of_day():
    order_ids = [f"D{i}" for i in range(151)]
    calls = []

    def handle(request):
        calls.append(request)
        if request.url.path.split("/")[-1] == "DON_HANG":
            assert request.url.params["thoi_gian_dat"] == "lte.2026-11-08T23:59:59.999999+07:00"
            return httpx.Response(200, json=[])
        assert request.url.params["order"] == "ma_ct_donhang.asc"
        selected = request.url.params["ma_donhang"]
        if "D0," not in selected:
            return httpx.Response(200, json=[])
        offset, limit = int(request.url.params["offset"]), int(request.url.params["limit"])
        return httpx.Response(200, json=[{"ma_ct_donhang": i} for i in range(offset, min(offset+limit,1001))])

    with httpx.Client(transport=httpx.MockTransport(handle)) as client:
        repo = CrmAnalyticsRepository(SyncPostgrestClient("https://fixture.test/rest/v1", http_client=client))
        result = repo.order_lines(order_ids)
        assert [row["ma_ct_donhang"] for row in result] == list(range(1001))
        count = len(calls)
        assert repo.order_lines(order_ids) == result
        assert len(calls) == count  # Reuse the same request's line list.
        repo.completed_orders(end="2026-11-08")


@pytest.mark.parametrize("code,message", [("57014", "timeout"), ("42703", "missing ngay_sinh")])
def test_customer_read_failure_does_not_remove_gender_as_a_fallback(code, message):
    calls = []

    def handle(request):
        calls.append(request)
        return httpx.Response(400, json={"code": code, "message": message, "details": None, "hint": None})

    with httpx.Client(transport=httpx.MockTransport(handle)) as client:
        repo = CrmAnalyticsRepository(SyncPostgrestClient("https://fixture.test/rest/v1", http_client=client))
        with pytest.raises(APIError):
            repo.customers()
    assert len(calls) == 1


def test_only_a_missing_gender_column_uses_the_legacy_projection():
    calls = []

    def handle(request):
        calls.append(request)
        assert request.url.params["order"] == "ma_kh.asc"
        if "gioi_tinh" in request.url.params["select"]:
            return httpx.Response(400, json={"code": "42703", "message": "column KHACH_HANG.gioi_tinh does not exist", "details": None, "hint": None})
        return httpx.Response(200, json=[{"ma_kh": "KH1"}])

    with httpx.Client(transport=httpx.MockTransport(handle)) as client:
        repo = CrmAnalyticsRepository(SyncPostgrestClient("https://fixture.test/rest/v1", http_client=client))
        assert repo.customers() == [{"ma_kh": "KH1"}]
    assert len(calls) == 2


def test_submitted_empty_survey_is_counted_but_pending_answers_are_not():
    tables = {
        "GUI_KHAO_SAT": [
            {"ma_gui": "DONE", "ma_kh": "KH1", "hoan_thanh_luc": "2026-11-08T00:00:00Z"},
            {"ma_gui": "EMPTY", "ma_kh": "KH1", "hoan_thanh_luc": "2026-11-08T00:01:00Z"},
            {"ma_gui": "PENDING", "ma_kh": "KH1", "hoan_thanh_luc": None},
        ],
        "KHACH_HANG": [{"ma_kh": "KH1", "ten_kh": "Fixture customer"}],
        "CAU_HOI_KHAO_SAT": [{"ma_cau_hoi": "Q", "loai_cau_hoi": "DIEM_1_5", "nhom_noi_dung": "HAI_LONG"}],
        "TRA_LOI_KHAO_SAT": [
            {"ma_tra_loi": "A", "ma_gui": "DONE", "ma_cau_hoi": "Q", "diem": 4},
            {"ma_tra_loi": "B", "ma_gui": "PENDING", "ma_cau_hoi": "Q", "diem": 1},
        ],
    }
    keys = {"GUI_KHAO_SAT": "ma_gui", "KHACH_HANG": "ma_kh", "CAU_HOI_KHAO_SAT": "ma_cau_hoi", "TRA_LOI_KHAO_SAT": "ma_tra_loi"}

    def handle(request):
        table = request.url.path.split("/")[-1]
        assert request.url.params["order"] == keys[table] + ".asc"
        return httpx.Response(200, json=tables[table])

    with httpx.Client(transport=httpx.MockTransport(handle)) as client:
        repo = CrmAnalyticsRepository(SyncPostgrestClient("https://fixture.test/rest/v1", http_client=client))
        result = survey_insights([], repo.survey_responses())
    assert result["total_responses"] == 2
    assert result["rated_responses"] == 1
    assert result["total_ratings"] == 1
    assert result["avg_overall_score"] == 4.0
    assert result["recent_feedbacks"][0]["overall_score"] is None
