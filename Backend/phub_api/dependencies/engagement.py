from fastapi import Depends, Request, Response

from phub_api.config.database import get_supabase
from phub_api.dependencies.auth import require_admin, require_customer_user
from phub_api.dependencies.origin import check_origin
from phub_api.models.user import User
from phub_api.repositories.engagement import EngagementRepository
from phub_api.services.engagement import EngagementService


def public_read(response: Response, db=Depends(get_supabase)):
    response.headers["Cache-Control"] = "no-store"
    return EngagementService(EngagementRepository(db))


def admin_read(service: EngagementService = Depends(public_read), user: User = Depends(require_admin)):
    return EngagementService(service.repository, user)


def customer_read(service: EngagementService = Depends(public_read), user: User = Depends(require_customer_user)):
    return EngagementService(service.repository, user)


def admin_write(request: Request, service: EngagementService = Depends(admin_read)):
    check_origin(request)
    return service


def customer_write(request: Request, service: EngagementService = Depends(customer_read)):
    check_origin(request)
    return service
