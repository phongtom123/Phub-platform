from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header, Response

from phub_api.dependencies.customer import require_customer
from phub_api.dependencies.orders import get_repository
from phub_api.middleware.order_errors import OrderError
from phub_api.models.customer import CurrentCustomer
from phub_api.repositories.orders import OrderRepository
from phub_api.schemas.catalog import ErrorDetail
from phub_api.schemas.orders import CreateOrder


def create_order(
    order: CreateOrder, response: Response,
    customer: Annotated[CurrentCustomer, Depends(require_customer)],
    idempotency_key: Annotated[str, Header(alias="Idempotency-Key", min_length=36, max_length=36, description="UUID v4 mới cho một lần đặt; giữ nguyên key khi retry.", examples=["0672b8b1-86ea-4f51-8668-1c722b8a9d99"])],
    repository: Annotated[OrderRepository, Depends(get_repository)],
):
    try:
        key = UUID(idempotency_key)
        if key.version != 4:
            raise ValueError("Not UUID v4")
    except ValueError:
        raise OrderError(422, "VALIDATION_ERROR", "Idempotency-Key phải là UUID v4.", [ErrorDetail(field="Idempotency-Key", message="Phải là UUID v4.")]) from None
    receipt, replayed = repository.create(order, key, customer)
    response.status_code = 200 if replayed else 201
    response.headers["Idempotency-Replayed"] = "true" if replayed else "false"
    response.headers["Cache-Control"] = "no-store"
    return receipt
