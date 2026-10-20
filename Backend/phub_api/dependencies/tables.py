from fastapi import Depends

from phub_api.config.database import get_supabase
from phub_api.dependencies.auth import current_user
from phub_api.models.user import User
from phub_api.repositories.tables import TablesRepository
from phub_api.services.tables import TablesService


def get_service(user: User = Depends(current_user), db=Depends(get_supabase)) -> TablesService:
    return TablesService(TablesRepository(db), user)
