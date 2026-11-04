"""Atomic order persistence. Prices, errors and replay policy are handled by the service."""


class OrderRepository:
    def __init__(self, client):
        self.client = client

    def checkout(self, parameters):
        return self.client.rpc("customer_checkout_v2", parameters).execute().data
