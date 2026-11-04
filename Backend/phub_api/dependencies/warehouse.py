from fastapi import Depends

from phub_api.config.database import get_supabase
from phub_api.dependencies.auth import require_warehouse
from phub_api.repositories.warehouse import WarehouseRepository
from phub_api.services.warehouse import WarehouseService


def get_service(user=Depends(require_warehouse), db=Depends(get_supabase)):
    return WarehouseService(WarehouseRepository(db), user)
