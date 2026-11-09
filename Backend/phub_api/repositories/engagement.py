"""One RPC per survey/review action; SQL owns transactions and eligibility."""
class EngagementRepository:
    def __init__(self, client):
        self.client = client

    def survey_read(self, actor, admin, kind, survey_id, page):
        return self.client.rpc("crm_survey_read_v1", {
            "p_actor": actor, "p_admin": admin, "p_kind": kind,
            "p_id": survey_id, "p_page": page,
        }).execute().data

    def survey_write(self, actor, survey_id, action, payload, version):
        return self.client.rpc("crm_survey_write_v1", {
            "p_actor": actor, "p_id": survey_id, "p_action": action,
            "p_payload": payload, "p_version": version,
        }).execute().data

    def survey_audience(self, actor, config, scope, query, page):
        return self.client.rpc("crm_survey_audience_preview_v1", {
            "p_actor": actor, "p_config": config, "p_scope": scope, "p_query": query, "p_page": page,
        }).execute().data

    def customer_interests(self, actor, survey_id, query, page):
        return self.client.rpc("crm_customer_interests_v1", {
            "p_actor": actor, "p_survey_id": survey_id, "p_query": query, "p_page": page,
        }).execute().data

    def survey_results(self, actor, survey_id, query, page, text_page):
        return self.client.rpc("crm_survey_results_v1", {
            "p_actor": actor, "p_id": survey_id, "p_query": query, "p_page": page, "p_text_page": text_page,
        }).execute().data

    def review_insights(self, actor, query, date_from, date_to, min_reviews, sort, page, product, review_page, low_only):
        return self.client.rpc("crm_review_insights_v1", {
            "p_actor": actor, "p_query": query, "p_from": date_from.isoformat() if date_from else None,
            "p_to": date_to.isoformat() if date_to else None, "p_min_reviews": min_reviews,
            "p_sort": sort, "p_page": page, "p_product": product, "p_review_page": review_page, "p_low_only": low_only,
        }).execute().data

    def survey_submit(self, actor, survey_id, key, answers):
        return self.client.rpc("crm_survey_submit_v1", {
            "p_actor": actor, "p_id": survey_id, "p_key": key, "p_answers": answers,
        }).execute().data

    def review_read(self, actor, kind, product, status, page):
        return self.client.rpc("crm_review_read_v1", {
            "p_actor": actor, "p_kind": kind, "p_product": product, "p_status": status, "p_page": page,
        }).execute().data

    def review_write(self, actor, payload):
        return self.client.rpc("crm_review_write_v1", {"p_actor": actor,
            "p_product": payload.product_id, "p_order": payload.order_id,
            "p_stars": payload.stars, "p_text": payload.content,
            "p_version": str(payload.expected_version) if payload.expected_version else None,
        }).execute().data

    def moderate(self, actor, review_id, status, version):
        return self.client.rpc("crm_review_moderate_v1", {
            "p_actor": actor, "p_id": review_id, "p_status": status, "p_version": version,
        }).execute().data
