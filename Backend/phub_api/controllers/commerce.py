from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header, Query, Response

from phub_api.dependencies.commerce import get_repository
from phub_api.dependencies.customer import require_customer
from phub_api.middleware.payment_errors import PaymentError
from phub_api.models.customer import CurrentCustomer
from phub_api.repositories.commerce import CommerceRepository
from phub_api.schemas.commerce import CustomerOrderRequest, OrderQuery, QuoteRequest
from phub_api.schemas.orders import Recipient
from phub_api.schemas.payments import NoQuery, OrderId


Customer = Annotated[CurrentCustomer, Depends(require_customer)]


Repository = Annotated[CommerceRepository, Depends(get_repository)]


def current_profile(customer: Customer, repository: Repository, query: Annotated[NoQuery, Query()]):
    return repository.profile(customer)


def save_current_profile(request: Recipient, customer: Customer, repository: Repository, query: Annotated[NoQuery, Query()]):
    return repository.save_profile(request, customer)


def quote_checkout(request: QuoteRequest, customer: Customer, repository: Repository):
    return repository.quote(request, customer)


def create_customer_order(request: CustomerOrderRequest, customer: Customer, repository: Repository, response: Response,
                          idempotency_key: Annotated[str, Header(alias="Idempotency-Key", min_length=36, max_length=36)]):
    try:
        key = UUID(idempotency_key)
        if key.version != 4:
            raise ValueError("UUID v4 required")
    except ValueError:
        raise PaymentError(422, "VALIDATION_ERROR", "Idempotency-Key phải là UUID v4.") from None
    receipt, replayed = repository.create(request, customer, key)
    response.status_code = 200 if replayed else 201
    response.headers["Idempotency-Replayed"] = "true" if replayed else "false"
    return receipt


def list_orders(customer: Customer, repository: Repository, query: Annotated[OrderQuery, Query()]):
    return repository.orders(customer, query=query)


def order_detail(order_id: OrderId, customer: Customer, repository: Repository, query: Annotated[NoQuery, Query()]):
    return repository.orders(customer, order_id=order_id)


def order_invoice(order_id: OrderId, customer: Customer, repository: Repository, query: Annotated[NoQuery, Query()]):
    return repository.invoice(order_id, customer)
