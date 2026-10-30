"""A single RPC owns each transaction, including idempotency and stock ledger."""
class AdminOperationsRepository:
    def __init__(self, db):
        self.db = db

    def command(self, actor, resource, action, key, record_id, body):
        return self.db.rpc('admin_operation_v1', {
            'p_actor': actor, 'p_resource': resource, 'p_action': action,
            'p_key': str(key), 'p_id': record_id, 'p_body': body,
        }).execute().data

    def read(self, actor, kind, query):
        return self.db.rpc('admin_read_v1', {'p_actor': actor, 'p_kind': kind, 'p_query': query}).execute().data

    def business_report(self, actor, start, end):
        return self.db.rpc('admin_business_report_v1', {'p_actor': actor, 'p_start': start, 'p_end': end}).execute().data
