"""Customer persistence and RPC calls, without checkout orchestration."""
from phub_api.repositories.commerce_reads import OrderReadRepository


class CommerceRepository:
    def __init__(self, client):
        self.client = client
        self.reads = OrderReadRepository(client)

    def profile(self, customer_id):
        return (self.client.table("KHACH_HANG").select("ma_kh,ten_kh,sdt,dia_chi_chi_tiet_md,tinh_thanh_md,xa_phuong_md")
                .eq("ma_kh", customer_id).limit(1).execute().data)

    def save_profile(self, customer_id, values):
        return self.client.table("KHACH_HANG").update(values).eq("ma_kh", customer_id).execute().data

    def checkout(self, parameters):
        return self.client.rpc("customer_checkout_v2", parameters).execute().data

    def orders(self, parameters):
        return self.client.rpc("customer_read_orders_v2", parameters).execute().data
