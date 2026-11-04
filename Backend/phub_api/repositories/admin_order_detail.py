"""Read-only, order-scoped queries for the admin aggregate endpoint."""
from phub_api.repositories.tables import TablesRepository


class AdminOrderDetailRepository:
    def __init__(self, client):
        self.client = client
        self.tables = TablesRepository(client)

    def order(self, order_id, user):
        return self.tables.detail("orders", user, [order_id])

    def children_page(self, name, order_id, user, page):
        return self.tables.page(name, user, page, 100, "", None, order_id)

    def customer(self, customer_id):
        if not customer_id:
            return None
        rows = (self.client.table("KHACH_HANG").select("ma_kh,ten_kh,sdt")
                .eq("ma_kh", customer_id).limit(1).execute().data)
        return rows[0] if rows else None

    def employee(self, employee_id):
        if not employee_id:
            return None
        rows = (self.client.table("NHAN_VIEN").select("ma_nhan_vien,ho_ten")
                .eq("ma_nhan_vien", employee_id).limit(1).execute().data)
        return rows[0] if rows else None

    def history(self, order_id, actor_id):
        """Read the projection exposed by the service-only audit RPC.

        The RPC deliberately returns neither request hashes nor saved command
        results because those contain more order data than the timeline needs.
        """
        return self.client.rpc("admin_order_history_v1", {
            "p_actor": actor_id, "p_order_id": order_id,
        }).execute().data
