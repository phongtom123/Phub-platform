import os
from postgrest.exceptions import APIError

from ..orders.repository import PUBLIC_ERRORS
from ..payments.auth import CurrentCustomer
from ..payments.errors import PaymentError
from .rpc import checkout_parameters
from .schemas import CheckoutQuote, CustomerOrderReceipt, CustomerProfile, OrderDetail, OrderPage
from .reads import OrderReader


ERRORS = {
    **PUBLIC_ERRORS,
    "ORDER_NOT_FOUND": (404, "Không tìm thấy đơn hàng thuộc tài khoản của bạn."),
    "AUTH_CUSTOMER_UNAVAILABLE": (403, "Tài khoản chưa liên kết khách hàng hợp lệ."),
    "VOUCHER_NOT_AVAILABLE": (409, "Mã giảm giá không khả dụng hoặc đã hết hạn."),
    "VOUCHER_MINIMUM_NOT_MET": (409, "Giá trị đơn chưa đạt mức tối thiểu của mã giảm giá."),
    "VOUCHER_LIMIT_REACHED": (409, "Mã giảm giá đã hết lượt sử dụng."),
    "CHECKOUT_CHANGED": (409, "Tổng tiền hoặc giảm giá đã thay đổi. Vui lòng lấy báo giá và xác nhận lại."),
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


class CommerceRepository:
    def __init__(self, client):
        self.client = client

    def profile(self, customer):
        verified(customer)
        rows = (self.client.table("KHACH_HANG").select("ma_kh,ten_kh,sdt,dia_chi_chi_tiet_md,tinh_thanh_md,xa_phuong_md")
                .eq("ma_kh", customer.customer_id).limit(1).execute().data)
        if not rows or len(rows) != 1 or rows[0]["ma_kh"] != customer.customer_id:
            raise PaymentError(403, "AUTH_CUSTOMER_UNAVAILABLE", "Tài khoản chưa liên kết khách hàng hợp lệ.")
        row = rows[0]
        return CustomerProfile(customer_id=row["ma_kh"], name=row["ten_kh"], phone=row.get("sdt"),
                               address_line=row.get("dia_chi_chi_tiet_md"), province=row.get("tinh_thanh_md"), ward=row.get("xa_phuong_md"))

    def save_profile(self, request, customer):
        self.profile(customer)
        values = {"ten_kh": request.name, "sdt": request.phone,
                  "dia_chi_chi_tiet_md": request.address_line,
                  "tinh_thanh_md": request.province, "xa_phuong_md": request.ward}
        rows = self.client.table("KHACH_HANG").update(values).eq("ma_kh", customer.customer_id).execute().data
        if not rows or len(rows) != 1 or rows[0].get("ma_kh") != customer.customer_id:
            raise PaymentError(403, "PROFILE_UPDATE_DENIED", "Không thể lưu thông tin nhận hàng của tài khoản này.")
        return self.profile(customer)

    def quote(self, request, customer):
        verified(customer)
        payload = request.model_dump(mode="json")
        payload["items"].sort(key=lambda item: item["sku"])
        result = checked_result(self.client.rpc("customer_checkout_v2", checkout_parameters(payload, customer, create=False)).execute().data)
        return CheckoutQuote.model_validate(result["quote"])

    def create(self, request, customer, key):
        verified(customer)
        result = checked_result(self.client.rpc("customer_checkout_v2", checkout_parameters(request.canonical_payload(), customer, create=True, key=key)).execute().data)
        if not isinstance(result.get("replayed"), bool):
            raise RuntimeError("Missing shopping replay flag")
        return CustomerOrderReceipt.model_validate(result["order"]), result["replayed"]

    def orders(self, customer, *, query=None, order_id=None):
        verified(customer)
        try:
            result = checked_result(self.client.rpc("customer_read_orders_v2", {
                "p_customer_id": customer.customer_id, "p_order_id": order_id,
                "p_page": query.page if query else 1, "p_page_size": query.page_size if query else 20,
                "p_currency": os.getenv("CATALOG_CURRENCY", "VND"),
            }).execute().data)
        except APIError as exc:
            if exc.code not in {"PGRST202", "42883"}:
                raise
            return OrderReader(self.client, os.getenv("CATALOG_CURRENCY", "VND")).orders(customer.customer_id, query=query, order_id=order_id)
        return OrderDetail.model_validate(result["order"]) if order_id is not None else OrderPage.model_validate(result)

    def invoice(self, order_id, customer):
        verified(customer)
        return OrderReader(self.client, os.getenv("CATALOG_CURRENCY", "VND")).invoice(order_id, customer.customer_id)
