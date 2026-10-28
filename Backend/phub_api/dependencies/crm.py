from fastapi import Depends, Request, Response

from phub_api.config.database import get_supabase
from phub_api.dependencies.auth import require_admin
from phub_api.dependencies.origin import check_origin
from phub_api.models.user import User
from phub_api.repositories.crm import CrmRepository
from phub_api.services.crm import CrmService


def read_service(response: Response, user: User = Depends(require_admin), db=Depends(get_supabase)):
    response.headers["Cache-Control"] = "no-store"
    return CrmService(CrmRepository(db), user)


def write_service(request: Request, service: CrmService = Depends(read_service)):
    check_origin(request)
    return service
