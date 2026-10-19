from typing import Annotated

from fastapi import Depends, Path, Query

from phub_api.dependencies.catalog import get_repository
from phub_api.middleware.catalog_errors import CatalogError
from phub_api.repositories.catalog import CatalogRepository
from phub_api.schemas.catalog import BrandList, CatalogQuery, CategoryList, ColorList, clean_text


Repository = Annotated[CatalogRepository, Depends(get_repository)]


def list_products(filters: Annotated[CatalogQuery, Query()], repository: Repository):
    return repository.list_products(filters)


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


def list_categories(repository: Repository):
    return CategoryList(items=repository.list_categories())


def list_brands(repository: Repository):
    return BrandList(items=repository.list_brands())


def list_colors(repository: Repository):
    return ColorList(items=repository.list_colors())
