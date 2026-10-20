from fastapi import APIRouter, Depends

from phub_api.dependencies.catalog import get_service
from phub_api.services.catalog import CatalogService

router = APIRouter()


@router.get("/api/products", deprecated=True, tags=["Public Catalog"])
def legacy_products(service: CatalogService = Depends(get_service)):
    return service.legacy_products()
