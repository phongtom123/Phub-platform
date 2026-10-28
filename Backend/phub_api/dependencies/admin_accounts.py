from fastapi import Depends, Request, Response

from phub_api.config.database import get_supabase
from phub_api.dependencies.auth import require_admin
from phub_api.dependencies.origin import check_origin
from phub_api.models.user import User
from phub_api.repositories.admin_accounts import AccountsRepository
from phub_api.services.admin_accounts import AccountsService


def read_service(response: Response, user: User = Depends(require_admin), db=Depends(get_supabase)):
    response.headers["Cache-Control"] = "no-store"
    return AccountsService(AccountsRepository(db), user)


def write_service(request: Request, service: AccountsService = Depends(read_service)):
    check_origin(request)
    return service
