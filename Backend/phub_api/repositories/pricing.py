class PricingRepository:
    def __init__(self, db):
        self.db = db

    def context(self, actor, sku):
        return self.db.rpc('pricing_context_v1', {'p_actor': actor, 'p_sku': sku}).execute().data

    def configure(self, actor, sku, body):
        return self.db.rpc('pricing_config_v1', {'p_actor': actor, 'p_sku': sku, 'p_body': body}).execute().data

    def tax(self, actor, code, name, rate, create):
        return self.db.rpc('pricing_tax_v1', {'p_actor': actor, 'p_code': code, 'p_name': name, 'p_rate': str(rate), 'p_create': create}).execute().data

    def receipt(self, actor, receipt_id):
        return self.db.rpc('receipt_pricing_preview_v1', {'p_actor': actor, 'p_id': receipt_id}).execute().data
