from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Response

from phub_api.dependencies.crm_analytics import get_analytics_service, get_sales_analytics_service
from phub_api.schemas.api_contracts import READ_ERRORS, error_response
from phub_api.schemas.crm_analytics import CustomerInsightsReport
from phub_api.schemas.sales_analytics import ProductInvoiceInsightsReport, ProductSalesReport, ProductStockList
from phub_api.services.crm_analytics import CrmAnalyticsService
from phub_api.services.sales_analytics import SalesAnalyticsService

router = APIRouter(prefix="/api/crm/analytics", tags=["Admin · CRM Analytics"])
Service = Annotated[CrmAnalyticsService, Depends(get_analytics_service)]
SalesService = Annotated[SalesAnalyticsService, Depends(get_sales_analytics_service)]


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


@router.get("/product-invoice-insights", response_model=ProductInvoiceInsightsReport, responses=READ_ERRORS,
            summary="Thống kê sản phẩm, tồn kho khả dụng và hóa đơn: trạng thái thanh toán, phương thức, kênh bán, xu hướng (ADMIN)")
def product_invoice_insights(
    service: SalesService,
    response: Response,
    period: Literal["month", "quarter", "year"] = Query("month", description="Chu kỳ gom xu hướng hóa đơn: tháng, quý hoặc năm"),
    start: date | None = Query(None, description="Ngày bắt đầu theo thời gian lập hóa đơn (tùy chọn)"),
    end: date | None = Query(None, description="Ngày kết thúc theo thời gian lập hóa đơn (tùy chọn)"),
):
    response.headers["Cache-Control"] = "no-store"
    return service.product_invoice_insights(period=period, start=start, end=end)


@router.get("/product-sales", response_model=ProductSalesReport,
            responses={**READ_ERRORS, 404: error_response(404, "Không tìm thấy sản phẩm.")},
            summary="Diễn biến bán hàng của một sản phẩm theo kỳ, theo kênh và tồn khả dụng theo kho (ADMIN)")
def product_sales(
    service: SalesService,
    response: Response,
    sku: str = Query(..., min_length=1, max_length=100, description="Mã SKU của sản phẩm"),
    period: Literal["month", "quarter", "year"] = Query("month", description="Chu kỳ gom: tháng, quý hoặc năm"),
    start: date | None = Query(None, description="Ngày bắt đầu theo thời gian lập hóa đơn (tùy chọn)"),
    end: date | None = Query(None, description="Ngày kết thúc theo thời gian lập hóa đơn (tùy chọn)"),
):
    response.headers["Cache-Control"] = "no-store"
    return service.product_sales(sku=sku, period=period, start=start, end=end)


@router.get("/product-stock", response_model=ProductStockList, responses=READ_ERRORS,
            summary="Danh sách sản phẩm, tồn khả dụng, hết/sắp hết hàng và giá trị tồn, có lọc và phân trang (ADMIN)")
def product_stock(
    service: SalesService,
    response: Response,
    view: Literal["products", "stock", "low", "value", "sales"] = Query("products", description="products: theo tên; stock: tồn khả dụng giảm dần; low: hết/sắp hết; value: giá trị tồn giảm dần; sales: bán chạy trong kỳ"),
    status: Literal["ACTIVE", "PAUSED", "HIDDEN", "ALL"] = Query("ACTIVE", description="Trạng thái sản phẩm"),
    category: str | None = Query(None, max_length=100, description="Mã loại sản phẩm"),
    q: str | None = Query(None, max_length=100, description="Tìm theo tên hoặc SKU, không phân biệt dấu"),
    start: date | None = Query(None, description="Ngày bắt đầu tính số lượng đã bán theo thời gian lập hóa đơn"),
    end: date | None = Query(None, description="Ngày kết thúc tính số lượng đã bán"),
    page: int = Query(1, ge=1, le=100000),
    page_size: int = Query(20, ge=1, le=100),
):
    response.headers["Cache-Control"] = "no-store"
    return service.product_stock(view=view, status=status, category=category or None, q=q, start=start, end=end,
                                 page=page, page_size=page_size)
