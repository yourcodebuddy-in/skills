class GatewayTimeout(Exception):
    """The gateway did not answer in time. The charge may or may not have been captured."""


class GatewayDeclined(Exception):
    """The card was declined."""


class Gateway:
    def __init__(self, client):
        self._client = client

    def charge(self, customer_id, amount_cents, idempotency_key=None):
        """Capture a charge. Requests that share an idempotency_key are captured at most once."""
        return self._client.post(
            "/charges",
            {
                "customer": customer_id,
                "amount": amount_cents,
                "idempotency_key": idempotency_key,
            },
        )
