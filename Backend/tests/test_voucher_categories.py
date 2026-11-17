import pytest
from fastapi import HTTPException

from phub_api.models.resources import ENUMS, public_columns
from phub_api.schemas.commerce import CustomerVoucher
from phub_api.services.tables import read_payload


@pytest.mark.parametrize("category", [None, "L_LINHKIEN", "L_DESKTOP"])
def test_voucher_scope_payload_accepts_exactly_three_scopes(category):
    assert read_payload({"ma_loai_sp_ap_dung": category}, "vouchers", True) == {"ma_loai_sp_ap_dung": category}


@pytest.mark.parametrize("category", ["OTHER", "SEED_L001", "", "component_cpu"])
def test_voucher_scope_cannot_target_other_categories(category):
    with pytest.raises(HTTPException) as error:
        read_payload({"ma_loai_sp_ap_dung": category}, "vouchers", True)
    assert error.value.status_code == 422


def test_voucher_scope_column_is_nullable_and_exposes_two_category_choices():
    column = next(c for c in public_columns("vouchers") if c["name"] == "ma_loai_sp_ap_dung")
    assert column["required"] is False
    assert ENUMS[("vouchers", "ma_loai_sp_ap_dung")] == ["L_LINHKIEN", "L_DESKTOP"]


def test_old_voucher_response_defaults_to_all_products():
    voucher = CustomerVoucher(code="OLD", discount_type="SO_TIEN", discount_value="100.00",
        minimum_order="0.00", maximum_discount=None, starts_at="2026-01-01T00:00:00Z",
        expires_at="2027-01-01T00:00:00Z", unavailable_reason=None)
    assert voucher.category_id is None
