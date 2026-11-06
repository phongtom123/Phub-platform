import os

from postgrest.exceptions import APIError

from phub_api.models.customer import CurrentCustomer
from phub_api.config.payment_demo import PaymentDemoSettings
from phub_api.models.errors import PaymentError
from phub_api.schemas.commerce import (
    AddressBook,
    CheckoutQuote,
    CustomerOrderReceipt,
    CustomerProfile,
    OrderDetail,
    OrderPage,
)
from phub_api.services.checkout import checkout_parameters
from phub_api.services.commerce_reads import OrderReadService
from phub_api.services.orders import PUBLIC_ERRORS


ERRORS = {
    **PUBLIC_ERRORS,
    "ORDER_NOT_FOUND": (404, "Không tìm thấy đơn hàng thuộc tài khoản của bạn."),
    "AUTH_CUSTOMER_UNAVAILABLE": (403, "Tài khoản chưa liên kết khách hàng hợp lệ."),
    "VOUCHER_NOT_AVAILABLE": (409, "Mã giảm giá không khả dụng hoặc đã hết hạn."),
    "VOUCHER_MINIMUM_NOT_MET": (409, "Giá trị đơn chưa đạt mức tối thiểu của mã giảm giá."),
    "VOUCHER_LIMIT_REACHED": (409, "Mã giảm giá đã hết lượt sử dụng."),
    "CHECKOUT_CHANGED": (409, "Tổng tiền hoặc giảm giá đã thay đổi. Vui lòng lấy báo giá và xác nhận lại."),
    "ADDRESS_NOT_FOUND": (404, "Không tìm thấy địa chỉ nhận hàng thuộc tài khoản của bạn."),
    "ADDRESS_LIMIT_REACHED": (409, "Sổ địa chỉ đã đạt tối đa 10 địa chỉ. Hãy xóa bớt địa chỉ không dùng."),
    "ORDER_ALREADY_CANCELLED": (409, "Đơn hàng này đã được hủy trước đó."),
    "ORDER_NOT_CANCELABLE": (409, "Đơn hàng đã được xuất kho hoặc hoàn thành, không thể hủy."),
}


def verified(customer):
    if not isinstance(customer, CurrentCustomer):
        raise PaymentError(503, "AUTH_INTEGRATION_REQUIRED", "Chưa có khách hàng đã được xác minh.")


def checked_result(value):
    if not isinstance(value, dict):
        raise RuntimeError("Invalid shopping RPC result")
    if "error" in value:
        code = value["error"].get("code") if isinstance(value["error"], dict) else None
        if code not in ERRORS:
            raise RuntimeError("Unknown shopping error")
        status, message = ERRORS[code]
        raise PaymentError(status, code, message)
    return value


class CommerceService:
    def __init__(self, repository):
        self.repository = repository

    def profile(self, customer):
        verified(customer)
        rows = self.repository.profile(customer.customer_id)
        if not rows or len(rows) != 1 or rows[0]["ma_kh"] != customer.customer_id:
            raise PaymentError(403, "AUTH_CUSTOMER_UNAVAILABLE", "Tài khoản chưa liên kết khách hàng hợp lệ.")
        row = rows[0]
        if row.get("luu_tru_luc") is not None:
            raise PaymentError(403, "AUTH_CUSTOMER_UNAVAILABLE", "Hồ sơ khách hàng đã được xóa mềm.")
        account = row.get("account")
        if isinstance(account, list):
            account = account[0] if len(account) == 1 else None
        avatar = account.get("avatar") if isinstance(account, dict) else None
        return CustomerProfile(customer_id=row["ma_kh"], name=row["ten_kh"], phone=row.get("sdt"),
                               address_line=row.get("dia_chi_chi_tiet_md"), province=row.get("tinh_thanh_md"),
                               ward=row.get("xa_phuong_md"),
                               avatar_url=avatar.get("url") if isinstance(avatar, dict) else None,
                               birthday=row.get("ngay_sinh"),
                               payment_bypass_enabled=PaymentDemoSettings.from_environment().enabled)

    def save_profile(self, request, customer):
        self.profile(customer)
        values = {"ten_kh": request.name, "sdt": request.phone,
                  "dia_chi_chi_tiet_md": request.address_line,
                  "tinh_thanh_md": request.province, "xa_phuong_md": request.ward}
        if "birthday" in request.model_fields_set:
            values["ngay_sinh"] = request.birthday.isoformat() if request.birthday else None
        rows = self.repository.save_profile(customer.customer_id, values)
        if not rows or len(rows) != 1 or rows[0].get("ma_kh") != customer.customer_id:
            raise PaymentError(403, "PROFILE_UPDATE_DENIED", "Không thể lưu thông tin nhận hàng của tài khoản này.")
        return self.profile(customer)

    def _addresses(self, customer, action, address_id=None, request=None):
        verified(customer)
        result = checked_result(self.repository.addresses({
            "p_customer_id": customer.customer_id, "p_action": action,
            "p_address_id": str(address_id) if address_id is not None else None,
            "p_payload": request.model_dump(mode="json") if request is not None else None,
        }))
        return AddressBook.model_validate(result)

    def list_addresses(self, customer):
        return self._addresses(customer, "list")

    def create_address(self, request, customer):
        return self._addresses(customer, "create", request=request)

    def update_address(self, address_id, request, customer):
        return self._addresses(customer, "update", address_id, request)

    def delete_address(self, address_id, customer):
        return self._addresses(customer, "delete", address_id)

    def quote(self, request, customer):
        verified(customer)
        payload = request.model_dump(mode="json")
        payload["items"].sort(key=lambda item: item["sku"])
        result = checked_result(self.repository.checkout(checkout_parameters(payload, customer, create=False)))
        return CheckoutQuote.model_validate(result["quote"])

    def create(self, request, customer, key):
        verified(customer)
        result = checked_result(self.repository.checkout(checkout_parameters(request.canonical_payload(), customer, create=True, key=key)))
        if not isinstance(result.get("replayed"), bool):
            raise RuntimeError("Missing shopping replay flag")
        return CustomerOrderReceipt.model_validate(result["order"]), result["replayed"]

    def orders(self, customer, *, query=None, order_id=None):
        verified(customer)
        try:
            result = checked_result(self.repository.orders({
                "p_customer_id": customer.customer_id, "p_order_id": order_id,
                "p_page": query.page if query else 1, "p_page_size": query.page_size if query else 20,
                "p_currency": os.getenv("CATALOG_CURRENCY", "VND"),
            }))
        except APIError as exc:
            if exc.code not in {"PGRST202", "42883"}:
                raise
            return OrderReadService(self.repository.reads, os.getenv("CATALOG_CURRENCY", "VND")).orders(customer.customer_id, query=query, order_id=order_id)
        return OrderDetail.model_validate(result["order"]) if order_id is not None else OrderPage.model_validate(result)

    def invoice(self, order_id, customer):
        verified(customer)
        return OrderReadService(self.repository.reads, os.getenv("CATALOG_CURRENCY", "VND")).invoice(order_id, customer.customer_id)

    def cancel_order(self, order_id, customer, request=None):
        verified(customer)
        reason = request.reason if request is not None else None
        result = checked_result(self.repository.cancel_order({
            "p_customer_id": customer.customer_id,
            "p_order_id": str(order_id),
            "p_reason": reason,
        }))
        if not isinstance(result, dict) or "order" not in result:
            raise RuntimeError("Invalid cancel order result representation")
        return OrderDetail.model_validate(result["order"])
