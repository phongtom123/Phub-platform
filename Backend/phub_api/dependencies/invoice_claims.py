from fastapi import Depends, HTTPException, Request, Response

from phub_api.config.database import get_supabase
from phub_api.dependencies.auth import current_user, require_customer_user
from phub_api.dependencies.origin import check_origin
from phub_api.models.user import User
from phub_api.repositories.invoice_claims import InvoiceClaimsRepository
from phub_api.services.invoice_claims import InvoiceClaimsService


def staff_read(response: Response, actor: User = Depends(current_user), db=Depends(get_supabase)):
    if actor.role != 'NHAN_VIEN' or not actor.employee_id:
        raise HTTPException(403, 'Chỉ nhân viên hoặc quản trị viên được truy cập.')
    response.headers['Cache-Control'] = 'no-store'
    return InvoiceClaimsService(InvoiceClaimsRepository(db), actor)


def customer_write(request: Request, response: Response, actor: User = Depends(require_customer_user), db=Depends(get_supabase)):
    check_origin(request)
    response.headers['Cache-Control'] = 'no-store'
    return InvoiceClaimsService(InvoiceClaimsRepository(db), actor)


def staff_write(request: Request, service: InvoiceClaimsService = Depends(staff_read)):
    check_origin(request)
    return service
