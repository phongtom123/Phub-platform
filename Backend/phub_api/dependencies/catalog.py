import os

from phub_api.repositories.catalog import CatalogRepository


def get_repository() -> CatalogRepository:
    from phub_api.config.database import supabase

    return CatalogRepository(
        supabase, currency=os.getenv("CATALOG_CURRENCY", "VND"),
        active_status=int(os.getenv("CATALOG_ACTIVE_STATUS", "1")),
    )
