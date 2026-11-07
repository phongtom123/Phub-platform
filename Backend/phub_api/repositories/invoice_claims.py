class InvoiceClaimsRepository:
    def __init__(self, db):
        self.db = db

    def create(self, actor, key, invoice_id, evidence):
        return self.db.rpc('customer_invoice_claim_v1', {
            'p_actor': actor, 'p_key': str(key), 'p_invoice': invoice_id, 'p_evidence': evidence,
        }).execute().data

    def read(self, actor, ticket_id=None, page=1):
        return self.db.rpc('staff_invoice_claim_read_v1', {
            'p_actor': actor, 'p_ticket': str(ticket_id) if ticket_id else None, 'p_page': page,
        }).execute().data

    def decide(self, actor, ticket_id, key, body):
        return self.db.rpc('staff_invoice_claim_decide_v1', {
            'p_actor': actor, 'p_ticket': str(ticket_id), 'p_key': str(key),
            'p_version': str(body.expected_version), 'p_action': body.action,
            'p_note': body.verification_note, 'p_verified': body.verified,
            'p_invoice_version': body.invoice_version,
        }).execute().data

    def catalog(self, actor, kind, query):
        return self.db.rpc('staff_counter_catalog_v1', {'p_actor': actor, 'p_kind': kind, 'p_query': query}).execute().data

    def customer_email(self, actor, email):
        return self.db.rpc('staff_counter_customer_email_v1', {'p_actor': actor, 'p_email': email}).execute().data

    def order(self, actor, key, body):
        return self.db.rpc('staff_counter_order_email_v1', {
            'p_actor': actor,
            'p_key': str(key), 'p_body': body.model_dump(mode='json', exclude_none=True),
        }).execute().data
