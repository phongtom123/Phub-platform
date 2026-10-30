from decimal import Decimal
from types import SimpleNamespace
import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from phub_api.schemas.pricing import PricePreview, TaxRule
from phub_api.services.pricing import calculate_price, PricingService
from phub_api.models.user import User

def test_decimal_formula_multi_tax_zero_and_vnd_rounding():
    price = calculate_price(Decimal('1000000'), Decimal('20'), [
        {'code': 'VAT', 'name': 'VAT', 'rate': '10'}, {'code': 'OTHER', 'name': 'Other', 'rate': '2'}])
    assert price['profit'] == '200000' and price['pre_tax'] == '1200000' and price['after_tax'] == '1344000'
    assert sorted(tax['amount'] for tax in price['taxes']) == ['120000', '24000']
    assert calculate_price(Decimal('0'), Decimal('0'), [])['actual_markup'] is None
    assert calculate_price(Decimal('100'), Decimal('0'), [{'code': 'ZERO', 'name': 'Zero', 'rate': '0'}])['after_tax'] == '100'
    assert calculate_price(Decimal('5'), Decimal('10'), [{'code': 'VAT', 'name': 'VAT', 'rate': '50'}])['after_tax'] == '9'

def test_preview_rejects_tampering_and_staff_override():
    for patch in [{'unit_cost': '-1'}, {'markup_rate': '-1'}, {'taxes': [{'code': 'VAT', 'rate': '101'}]}, {'after_tax': '1'}, {'unit_cost': 1.2}, {'unit_cost': 'NaN'}]:
        with pytest.raises(ValidationError): PricePreview.model_validate({'sku': 'S', 'unit_cost': '100', **patch})
    repository = SimpleNamespace(context=lambda *args: {'markup_rate': '20', 'taxes': [{'code': 'VAT', 'rate': '10'}], 'catalog': [{'code': 'VAT', 'name': 'VAT', 'active': True, 'rate': '10'}], 'current_price': '100'})
    staff = PricingService(repository, User('W', 'staff', 'NHAN_VIEN', 'Staff', employee_id='NV', warehouse_id=2))
    assert staff.preview(PricePreview(sku='S', unit_cost='100'))['after_tax'] == '132'
    with pytest.raises(HTTPException) as error: staff.preview(PricePreview(sku='S', unit_cost='100', markup_rate='20'))
    assert error.value.status_code == 403
    with pytest.raises(HTTPException): staff.preview(PricePreview(sku='S', unit_cost='100', taxes=[TaxRule(code='VAT', rate='0')]))


def test_receipt_tax_does_not_require_catalog_and_preserves_name():
    repository = SimpleNamespace(context=lambda *args: {'markup_rate': '0', 'taxes': [], 'catalog': [], 'current_price': '100'})
    admin = PricingService(repository, User('A', 'admin', 'ADMIN', 'Admin', employee_id='AD'))
    body = PricePreview(sku='S', unit_cost='100', markup_rate='20', taxes=[TaxRule(code='LOCAL', name='Local tax', rate='10')])
    result = admin.preview(body)
    assert result['after_tax'] == '132'
    assert result['taxes'][0]['name'] == 'Local tax'
    assert admin.preview(PricePreview(sku='S', unit_cost='100'))['taxes'] == []
    with pytest.raises(HTTPException) as error:
        admin.preview(body.model_copy(update={'taxes': [body.taxes[0], body.taxes[0]]}))
    assert error.value.status_code == 422


def test_saved_receipt_inputs_drive_preview_without_global_defaults():
    repository = SimpleNamespace(
        context=lambda *args: {'markup_rate': '0', 'taxes': [], 'catalog': [], 'current_price': '100'},
        receipt=lambda *args: {'status': 'NHAP', 'lines': [{'sku': 'S', 'price': {
            'markup_rate': '30', 'taxes': [{'code': 'LOCAL', 'name': 'Saved name', 'rate': '5', 'amount': '7'}]}}]})
    service = PricingService(repository, User('W', 'staff', 'NHAN_VIEN', 'Staff', employee_id='NV', warehouse_id=2))
    result = service.preview(PricePreview(sku='S', unit_cost='200', receipt_id=1))
    assert result['pre_tax'] == '260' and result['after_tax'] == '273'
    assert result['taxes'][0]['amount'] == '13'
