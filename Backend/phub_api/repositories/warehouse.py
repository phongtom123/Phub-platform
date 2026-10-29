"""All receipt writes and stock changes belong to one atomic database RPC."""


class WarehouseRepository:
    def __init__(self, db):
        self.db = db

    def read(self, actor, kind, query):
        return self.db.rpc('warehouse_read_v1', {'p_actor': actor, 'p_kind': kind, 'p_query': query}).execute().data

    def command(self, actor, action, key, receipt_id, body):
        return self.db.rpc('warehouse_receipt_v1', {
            'p_actor': actor, 'p_action': action, 'p_key': str(key), 'p_id': receipt_id, 'p_body': body,
        }).execute().data
