"""Ownership-scoped payment projections; never expose a write API for money."""
from phub_api.models.customer import CurrentCustomer

TRANSACTION_COLUMNS = (
    "so_tien::text,loai_giao_dich,phuong_thuc,trang_thai,thoi_gian,"
    "owned_order:DON_HANG!inner(ma_donhang,ma_kh)"
)


class PaymentRepository:
    def __init__(self, client, currency="VND"):
        self.client, self.currency = client, currency

    def owned_order(self, order_id, customer_id):
        return (self.client.table("DON_HANG").select("ma_donhang,ma_kh")
                .eq("ma_donhang", order_id).eq("ma_kh", customer_id).limit(1).execute().data)

    def transaction_query(self, order_id, customer: CurrentCustomer, *, count=None, head=False):
        columns = "ma_donhang,owned_order:DON_HANG!inner(ma_kh)" if head else TRANSACTION_COLUMNS
        return (self.client.table("THANH_TOAN").select(columns, count=count, head=head)
                .eq("ma_donhang", order_id).eq("owned_order.ma_kh", customer.customer_id)
                .order("thoi_gian", desc=True, nullsfirst=False).order("ma_thanh_toan", desc=True))

    def latest(self, order_id, customer):
        return self.transaction_query(order_id, customer).limit(1).execute().data

    def page(self, order_id, customer, page, page_size):
        offset = (page - 1) * page_size
        return self.transaction_query(order_id, customer, count="exact").range(offset, offset + page_size - 1).execute()

    def count(self, order_id, customer):
        return self.transaction_query(order_id, customer, count="exact", head=True).limit(1).execute().count
