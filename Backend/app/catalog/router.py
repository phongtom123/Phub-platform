import os
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query

from .errors import CatalogError, CatalogRoute
from .repository import CatalogRepository
from .schemas import (
    BrandList, CatalogProduct, CatalogQuery, CategoryList, ErrorResponse,
    ProductPage, clean_text,
)


def documented_error(code: str, message: str, details=None):
    return {
        "model": ErrorResponse,
        "description": message,
        "content": {"application/json": {"example": {
            "error": {"code": code, "message": message, "details": details or []},
        }}},
    }


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


def get_repository() -> CatalogRepository:
    # Lazy import keeps catalog tests independent of credentials and real DB.
    # Reuse the team's existing client without modifying its initialization.
    from ..supabase import supabase

    return CatalogRepository(
        supabase, currency=os.getenv("CATALOG_CURRENCY", "VND"),
        active_status=int(os.getenv("CATALOG_ACTIVE_STATUS", "1")),
    )


Repository = Annotated[CatalogRepository, Depends(get_repository)]


@router.get("/products", response_model=ProductPage, summary="Danh sách sản phẩm đang bán")
def list_products(filters: Annotated[CatalogQuery, Query()], repository: Repository):
    """Catalog công khai cho desktop và mobile. Sản phẩm và loại sản phẩm phải
    hoạt động (mặc định trang_thai=1). Không lọc theo tồn kho.
    Tìm kiếm, lọc, sắp xếp thực hiện tại database trước khi phân trang.
    Không có kết quả hoặc trang vượt phạm vi trả 200 với items rỗng.
    """
    return repository.list_products(filters)


@router.get(
    "/products/{product_id}", response_model=CatalogProduct,
    summary="Chi tiết sản phẩm công khai, ảnh và thông số",
    responses={404: documented_error("PRODUCT_NOT_FOUND", "Không tìm thấy sản phẩm.")},
)
def get_product(
    product_id: Annotated[str, Path(min_length=1, max_length=100, description="ma_sp trong SAN_PHAM, không phải SKU")],
    repository: Repository,
):
    try:
        cleaned_id = clean_text(product_id)
    except ValueError:
        raise CatalogError(422, "VALIDATION_ERROR", "Mã sản phẩm không hợp lệ.") from None
    if not cleaned_id:
        raise CatalogError(422, "VALIDATION_ERROR", "Mã sản phẩm không hợp lệ.")
    product = repository.get_product(cleaned_id)
    if product is None:
        raise CatalogError(404, "PRODUCT_NOT_FOUND", "Không tìm thấy sản phẩm.")
    return product


@router.get("/categories", response_model=CategoryList, summary="Các loại sản phẩm đang hoạt động")
def list_categories(repository: Repository):
    return CategoryList(items=repository.list_categories())


@router.get("/brands", response_model=BrandList, summary="Thương hiệu của sản phẩm công khai")
def list_brands(repository: Repository):
    """Trả các chuỗi thuong_hieu duy nhất. Dùng name làm giá trị query brand;
    schema hiện tại không có bảng thương hiệu hoặc brand_id.
    """
    return BrandList(items=repository.list_brands())
