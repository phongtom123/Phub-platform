"""All receipt writes and stock changes belong to one atomic database RPC."""


class WarehouseRepository:
    def __init__(self, db):
        self.db = db

    def read(self, actor, kind, query):
        return self.db.rpc('warehouse_read_v1', {'p_actor': actor, 'p_kind': kind, 'p_query': query}).execute().data

    def command(self, actor, action, key, receipt_id, body):
        return self.db.rpc('priced_receipt_v1', {
            'p_actor': actor, 'p_portal': 'WAREHOUSE', 'p_action': action, 'p_key': str(key), 'p_id': receipt_id, 'p_body': body,
        }).execute().data

    def manual_invoice_options(self, actor):
        return self.db.rpc('warehouse_manual_invoice_options_v1', {'p_actor': actor}).execute().data

    def search_invoice_customers(self, actor, query):
        return self.db.rpc('warehouse_invoice_customer_search_v1', {'p_actor': actor, 'p_query': query}).execute().data

    def create_manual_invoice(self, actor, key, warehouse_id, body):
        return self.db.rpc('warehouse_manual_invoice_v1', {
            'p_actor': actor, 'p_key': str(key), 'p_warehouse': warehouse_id, 'p_body': body,
        }).execute().data
