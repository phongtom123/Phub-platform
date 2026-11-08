from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Response

from phub_api.dependencies.crm_analytics import get_analytics_service
from phub_api.schemas.api_contracts import READ_ERRORS
from phub_api.schemas.crm_analytics import CustomerInsightsReport
from phub_api.services.crm_analytics import CrmAnalyticsService

router = APIRouter(prefix="/api/crm/analytics", tags=["Admin · CRM Analytics"])
Service = Annotated[CrmAnalyticsService, Depends(get_analytics_service)]


@router.get("/customer-insights", response_model=CustomerInsightsReport, responses=READ_ERRORS,
            summary="Thống kê tệp khách hàng: nhân khẩu học, mức chi tiêu trung bình, sản phẩm mua nhiều và định hướng phát triển (ADMIN)")
def customer_insights(
    service: Service,
    response: Response,
    period: Literal["month", "quarter", "year"] = Query("month", description="Chu kỳ thống kê: tháng, quý hoặc năm"),
    start: date | None = Query(None, description="Ngày bắt đầu (tùy chọn)"),
    end: date | None = Query(None, description="Ngày kết thúc (tùy chọn)"),
    status_scope: Literal["ACTIVE", "COMPLETED"] = Query("ACTIVE", description="Phạm vi đơn: ACTIVE (Tất cả đơn có hiệu lực trừ đơn hủy) hoặc COMPLETED (Chỉ đơn hoàn thành)"),
):
    response.headers["Cache-Control"] = "no-store"
    return service.customer_insights(period=period, start=start, end=end, status_scope=status_scope)

