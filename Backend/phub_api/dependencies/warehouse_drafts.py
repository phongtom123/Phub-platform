from fastapi import Depends

from phub_api.config.database import get_supabase
from phub_api.dependencies.auth import require_admin
from phub_api.models.user import User
from phub_api.repositories.tables import TablesRepository
from phub_api.services.warehouse_drafts import WarehouseDraftService


def get_service(user: User = Depends(require_admin), db=Depends(get_supabase)) -> WarehouseDraftService:
    return WarehouseDraftService(TablesRepository(db), user)
