from typing import Annotated, Literal

from fastapi import Depends, Query, Request, Response

from app.controllers.auth import logout
from app.dependencies.admin_accounts import read_service, write_service
from app.schemas.admin_accounts import (
    AccountCreate, AccountUpdate, Identifier, NewAccountCreate, PasswordChange,
    PasswordReset, Role, RoleUpdate, StatusUpdate,
)
from app.services.admin_accounts import Accounts
from app.services.auth import throttle


Read = Annotated[Accounts, Depends(read_service)]
Write = Annotated[Accounts, Depends(write_service)]


def list_accounts(service: Read, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                  q: str = Query("", max_length=100), status: int | None = Query(None, ge=0, le=2), role: Role | None = None):
    return service.page(page, page_size, q, status, role)


def account_owners(service: Read, kind: Literal["employees", "customers"] = "employees", q: str = Query("", max_length=100),
                   page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100)):
    return service.owners(kind, page, page_size, q)


def create_account(body: NewAccountCreate | AccountCreate, service: Write):
    return service.create_new(body) if isinstance(body, NewAccountCreate) else service.create(body)


def get_account(account_id: Identifier, service: Read):
    return service.detail(account_id)


def update_account(account_id: Identifier, body: AccountUpdate, service: Write):
    return service.update(account_id, body)


def set_status(account_id: Identifier, body: StatusUpdate, service: Write):
    return service.status(account_id, body.trang_thai)


def set_role(account_id: Identifier, body: RoleUpdate, service: Write):
    return service.role(account_id, body)


def reset_password(account_id: Identifier, body: PasswordReset, service: Write):
    return service.password(account_id, body.password)


def my_account(service: Read):
    return service.detail(service.actor.account_id)


def update_me(body: AccountUpdate, service: Write):
    return service.update(service.actor.account_id, body)


def change_my_password(body: PasswordChange, request: Request, response: Response, service: Write):
    throttle(request)
    result = service.password(service.actor.account_id, body.password, body.current_password)
    logout(request, response)
    return result
