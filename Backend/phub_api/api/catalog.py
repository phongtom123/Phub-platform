from fastapi import APIRouter

from phub_api.controllers import catalog
from phub_api.middleware.catalog_errors import CatalogRoute
from phub_api.schemas.catalog import BrandList, CatalogProduct, CategoryList, ProductPage, ColorList
from phub_api.api.responses import documented_error

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

router.get("/products", response_model=ProductPage, summary="Danh sách sản phẩm đang bán")(catalog.list_products)

router.get(
    "/products/{product_id}", response_model=CatalogProduct,
    summary="Chi tiết sản phẩm công khai, ảnh và thông số",
    responses={404: documented_error("PRODUCT_NOT_FOUND", "Không tìm thấy sản phẩm.")},
)(catalog.get_product)

router.get("/categories", response_model=CategoryList, summary="Các loại sản phẩm đang hoạt động")(catalog.list_categories)

router.get("/brands", response_model=BrandList, summary="Thương hiệu của sản phẩm công khai")(catalog.list_brands)

router.get("/colors", response_model=ColorList, summary="Các màu đã ghi trong thông số sản phẩm đang bán")(catalog.list_colors)
