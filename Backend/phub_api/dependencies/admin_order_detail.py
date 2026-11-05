from fastapi import Depends

from phub_api.config.database import get_supabase
from phub_api.dependencies.auth import require_admin
from phub_api.models.user import User
from phub_api.repositories.admin_order_detail import AdminOrderDetailRepository
from phub_api.services.admin_order_detail import AdminOrderDetailService


def get_service(user: User = Depends(require_admin), db=Depends(get_supabase)):
    return AdminOrderDetailService(AdminOrderDetailRepository(db), user)
