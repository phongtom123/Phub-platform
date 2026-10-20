import os

from fastapi import Depends

from phub_api.config.database import get_supabase
from phub_api.repositories.catalog import CatalogRepository
from phub_api.services.catalog import CatalogService


def get_repository(db=Depends(get_supabase)) -> CatalogRepository:
    return CatalogRepository(
        db, currency=os.getenv("CATALOG_CURRENCY", "VND"),
        active_status=int(os.getenv("CATALOG_ACTIVE_STATUS", "1")),
    )


def get_service(repository: CatalogRepository = Depends(get_repository)) -> CatalogService:
    return CatalogService(repository)
