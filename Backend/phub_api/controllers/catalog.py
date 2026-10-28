from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query

from phub_api.dependencies.catalog import get_service
from phub_api.middleware.catalog_errors import CatalogRoute
from phub_api.schemas.catalog import (
    BrandList,
    CatalogProduct,
    CatalogQuery,
    CategoryList,
    ColorList,
    ProductPage,
)
from phub_api.schemas.responses import documented_error
from phub_api.services.catalog import CatalogService


ERROR_RESPONSES = {
    422: documented_error(
        "VALIDATION_ERROR", "Tham số không hợp lệ.",
        [{"field": "page", "message": "Phải lớn hơn hoặc bằng 1."}],
    ),
    500: documented_error("INTERNAL_ERROR", "Không thể xử lý yêu cầu catalog."),
    503: documented_error("DATA_SERVICE_UNAVAILABLE", "Dịch vụ dữ liệu tạm thời không khả dụng."),
}

router = APIRouter(
    prefix="/api/catalog", tags=["Public Catalog"], route_class=CatalogRoute,
    responses=ERROR_RESPONSES,
)

Service = Annotated[CatalogService, Depends(get_service)]


@router.get("/products", response_model=ProductPage, summary="Danh sách sản phẩm đang bán")
def list_products(filters: Annotated[CatalogQuery, Query()], service: Service):
    return service.list_products(filters)


@router.get(
    "/products/{product_id}", response_model=CatalogProduct,
    summary="Chi tiết sản phẩm công khai, ảnh và thông số",
    responses={404: documented_error("PRODUCT_NOT_FOUND", "Không tìm thấy sản phẩm.")},
)
def get_product(
    product_id: Annotated[str, Path(min_length=1, max_length=100, description="ma_sp trong SAN_PHAM, không phải SKU")],
    service: Service,
):
    return service.get_product(product_id)


@router.get("/categories", response_model=CategoryList, summary="Các loại sản phẩm đang hoạt động")
def list_categories(service: Service):
    return CategoryList(items=service.list_categories())


@router.get("/brands", response_model=BrandList, summary="Thương hiệu của sản phẩm công khai")
def list_brands(service: Service):
    return BrandList(items=service.list_brands())


@router.get("/colors", response_model=ColorList, summary="Các màu đã ghi trong thông số sản phẩm đang bán")
def list_colors(service: Service):
    return ColorList(items=service.list_colors())
