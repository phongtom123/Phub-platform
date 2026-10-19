from fastapi import Depends, Request, Response

from app.config.database import get_supabase
from app.dependencies.auth import require_admin
from app.dependencies.origin import check_origin
from app.models.user import User
from app.services.admin_accounts import Accounts


def read_service(response: Response, user: User = Depends(require_admin), db=Depends(get_supabase)):
    response.headers["Cache-Control"] = "no-store"
    return Accounts(db, user)


def write_service(request: Request, service: Accounts = Depends(read_service)):
    check_origin(request)
    return service
