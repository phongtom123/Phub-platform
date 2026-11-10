from uuid import uuid4

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from phub_api.models.user import User
from phub_api.schemas.warehouse import ManualInvoiceCreate
from phub_api.services.warehouse import WarehouseService


def valid_invoice():
    return {
        "buyer": "Nguyễn An",
        "email": "  AN@example.com ",
        "lines": [{"sku": "SKU-1", "quantity": 2, "unit_price": "12500.00", "discount": "500"}],
    }


def test_manual_invoice_normalizes_email_and_amounts():
    invoice = ManualInvoiceCreate.model_validate(valid_invoice())

    assert invoice.email == "an@example.com"
    assert invoice.model_dump(mode="json")["lines"][0] == {
        "sku": "SKU-1", "quantity": 2, "unit_price": "12500.00", "discount": "500",
    }


@pytest.mark.parametrize("email", ["", "not-an-email", "a@b", "two@@example.com"])
def test_manual_invoice_rejects_invalid_email(email):
    with pytest.raises(ValidationError):
        ManualInvoiceCreate.model_validate({**valid_invoice(), "email": email})


@pytest.mark.parametrize("quantity", ["2", 0, -1, 1.5, True])
def test_manual_invoice_requires_positive_integer_quantity(quantity):
    body = valid_invoice()
    body["lines"][0]["quantity"] = quantity
    with pytest.raises(ValidationError):
        ManualInvoiceCreate.model_validate(body)


def test_manual_invoice_service_sends_actor_key_warehouse_and_validated_body():
    class Repository:
        args = None

        def create_manual_invoice(self, *args):
            self.args = args
            return {"data": [{"id": "HD-1"}], "replayed": False}

    repository = Repository()
    user = User("account-1", "staff", "NHAN_VIEN", "Nhân viên", employee_id="staff-1", warehouse_id=8)
    key = uuid4()

    result = WarehouseService(repository, user).create_manual_invoice(
        key, ManualInvoiceCreate.model_validate(valid_invoice()),
    )

    assert result == {"data": [{"id": "HD-1"}], "replayed": False}
    assert repository.args == (
        "account-1", key, 8,
        {
            "buyer": "Nguyễn An",
            "email": "an@example.com",
            "lines": [{"sku": "SKU-1", "quantity": 2, "unit_price": "12500.00", "discount": "500"}],
        },
    )


def test_manual_invoice_service_rejects_unassigned_warehouse():
    class Repository:
        def create_manual_invoice(self, *args):
            raise AssertionError("Must not call the repository without an assigned warehouse.")

    user = User("account-1", "staff", "NHAN_VIEN", "Nhân viên", employee_id="staff-1")

    with pytest.raises(HTTPException) as error:
        WarehouseService(Repository(), user).create_manual_invoice(
            uuid4(), ManualInvoiceCreate.model_validate(valid_invoice()),
        )

    assert error.value.status_code == 403
