"""Customer persistence and RPC calls, without checkout orchestration."""
from phub_api.repositories.commerce_reads import OrderReadRepository


class CommerceRepository:
    def __init__(self, client):
        self.client = client
        self.reads = OrderReadRepository(client)

    def profile(self, customer_id):
        return (self.client.table("KHACH_HANG").select(
                "ma_kh,ten_kh,sdt,dia_chi_chi_tiet_md,tinh_thanh_md,xa_phuong_md,ngay_sinh,luu_tru_luc,"
                "account:TAI_KHOAN(avatar:MEDIA!TAI_KHOAN_avatar_media_fkey(url))")
                .eq("ma_kh", customer_id).limit(1).execute().data)

    def save_profile(self, customer_id, values):
        return self.client.table("KHACH_HANG").update(values).eq("ma_kh", customer_id).is_("luu_tru_luc", "null").execute().data

    def addresses(self, parameters):
        return self.client.rpc("customer_address_v1", parameters).execute().data

    def checkout(self, parameters):
        name = "customer_checkout_fulfillment_v1" if parameters["p_create"] else "customer_checkout_multi_warehouse_v1"
        return self.client.rpc(name, parameters).execute().data

    def vouchers(self, customer_id, timezone):
        return self.client.rpc('customer_voucher_choices_v1', {
            'p_customer_id': customer_id, 'p_timezone': timezone,
        }).execute().data

    def orders(self, parameters):
        return self.client.rpc("customer_read_orders_v4", parameters).execute().data

    def cancel_order(self, parameters):
        return self.client.rpc("customer_cancel_order_v1", parameters).execute().data
