from fastapi import Depends, Request, Response

from phub_api.config.database import get_supabase
from phub_api.dependencies.auth import require_admin, require_customer_user
from phub_api.dependencies.origin import check_origin
from phub_api.models.user import User
from phub_api.repositories.support import SupportRepository
from phub_api.services.support import SupportService


def admin_read(response: Response, actor: User = Depends(require_admin), db=Depends(get_supabase)):
    response.headers['Cache-Control'] = 'no-store'
    return SupportService(SupportRepository(db), actor)


def customer_read(response: Response, actor: User = Depends(require_customer_user), db=Depends(get_supabase)):
    response.headers['Cache-Control'] = 'no-store'
    return SupportService(SupportRepository(db), actor)


def admin_write(request: Request, service: SupportService = Depends(admin_read)):
    check_origin(request)
    return service


def customer_write(request: Request, service: SupportService = Depends(customer_read)):
    check_origin(request)
    return service
