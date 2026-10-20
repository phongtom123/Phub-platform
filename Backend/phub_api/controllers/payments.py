from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header, Query, Response

from phub_api.dependencies.customer import require_customer
from phub_api.dependencies.payments import get_payment_requests, get_repository
from phub_api.middleware.payment_errors import PaymentError
from phub_api.models.customer import CurrentCustomer
from phub_api.repositories.payments import PaymentRepository
from phub_api.schemas.payments import NoQuery, OrderId, PaymentRequest, TransactionQuery


def payment_overview(
    order_id: OrderId,
    customer: Annotated[CurrentCustomer, Depends(require_customer)],
    repository: Annotated[PaymentRepository, Depends(get_repository)],
    query: Annotated[NoQuery, Query()],
):
    return repository.overview(order_id, customer)


def transaction_history(
    order_id: OrderId,
    customer: Annotated[CurrentCustomer, Depends(require_customer)],
    repository: Annotated[PaymentRepository, Depends(get_repository)],
    query: Annotated[TransactionQuery, Query()],
):
    return repository.history(order_id, customer, query)


def request_order_payment(order_id: OrderId, request: PaymentRequest, response: Response,
    customer: Annotated[CurrentCustomer, Depends(require_customer)],
    repository: Annotated[PaymentRepository, Depends(get_repository)],
    service: Annotated[object, Depends(get_payment_requests)],
    idempotency_key: Annotated[str, Header(alias="Idempotency-Key", min_length=36, max_length=36)]):
    try:
        key = UUID(idempotency_key)
        if key.version != 4:
            raise ValueError()
    except ValueError:
        raise PaymentError(422, "VALIDATION_ERROR", "Idempotency-Key phải là UUID v4.") from None
    repository.require_owned_order(order_id, customer)
    result, replayed = service.request(order_id, customer, request.method, key)
    response.headers["Idempotency-Replayed"] = "true" if replayed else "false"
    return result
