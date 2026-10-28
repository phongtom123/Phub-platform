from fastapi import Depends
from phub_api.config.database import get_supabase
from phub_api.dependencies.auth import require_admin
from phub_api.repositories.admin_operations import AdminOperationsRepository
from phub_api.services.admin_operations import AdminOperationsService


def get_service(user=Depends(require_admin), db=Depends(get_supabase)):
    return AdminOperationsService(AdminOperationsRepository(db), user)
