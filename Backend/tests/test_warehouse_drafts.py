"""Validation tests for warehouse draft request bodies."""

import pytest
from pydantic import ValidationError

from app.warehouse.drafts import ReceiptDraftRequest, TransferDraftRequest


def test_receipt_draft_accepts_decimal_unit_price():
    body = ReceiptDraftRequest.model_validate({
        "supplier_id": 1,
        "warehouse_id": 2,
        "lines": [{"sku": "SKU-DEMO-001", "quantity": 3, "unit_price": "70000.00"}],
    })
    assert body.lines[0].unit_price == 70000


@pytest.mark.parametrize("payload", [
    {"supplier_id": 1, "warehouse_id": 2, "lines": []},
    {"supplier_id": 1, "warehouse_id": 2, "lines": [{"sku": "SKU", "quantity": 0, "unit_price": 1}]},
    {"supplier_id": 1, "warehouse_id": 2, "lines": [{"sku": "SKU", "quantity": 1, "unit_price": -1}]},
])
def test_receipt_draft_rejects_invalid_lines(payload):
    with pytest.raises(ValidationError):
        ReceiptDraftRequest.model_validate(payload)


def test_transfer_draft_rejects_empty_or_non_positive_lines():
    with pytest.raises(ValidationError):
        TransferDraftRequest.model_validate({
            "source_warehouse_id": 1,
            "destination_warehouse_id": 2,
            "lines": [],
        })
    with pytest.raises(ValidationError):
        TransferDraftRequest.model_validate({
            "source_warehouse_id": 1,
            "destination_warehouse_id": 2,
            "lines": [{"sku": "SKU", "quantity": 0}],
        })
