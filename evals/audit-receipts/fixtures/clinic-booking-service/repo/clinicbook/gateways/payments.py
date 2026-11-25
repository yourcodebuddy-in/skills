"""Card payment provider client. Cards are stored with the provider; we only hold its card reference."""

from __future__ import annotations

import json
import logging
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

log = logging.getLogger(__name__)


class PaymentDeclined(Exception):
    """The provider refused the charge, for example an expired card. Retrying won't help."""


class PaymentUnavailable(Exception):
    """The provider couldn't be reached or failed. The charge may be retried later."""


class PaymentGateway:
    def __init__(self, base_url: str, api_key: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    def charge(self, card_ref: str, amount_cents: int, currency: str, description: str) -> str:
        """Charge a stored card and return the provider's charge id."""
        data = json.dumps(
            {"card": card_ref, "amount": amount_cents, "currency": currency.lower(), "description": description}
        ).encode()
        request = Request(
            f"{self.base_url}/v2/charges",
            data=data,
            headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urlopen(request) as response:
                payload = json.load(response)
        except HTTPError as exc:
            if exc.code == 402:
                raise PaymentDeclined(f"card {card_ref} was declined") from exc
            raise PaymentUnavailable(f"payment provider answered {exc.code}") from exc
        except URLError as exc:
            raise PaymentUnavailable(f"payment provider unreachable: {exc.reason}") from exc
        except ValueError as exc:
            raise PaymentUnavailable("payment provider sent a response that isn't JSON") from exc
        return str(payload["id"])


class LogOnlyPayments:
    """Used when no provider is configured, as in development: charges go to the log."""

    def charge(self, card_ref: str, amount_cents: int, currency: str, description: str) -> str:
        log.info("charge (not made, no provider configured) %s %s to %s: %s", amount_cents, currency, card_ref, description)
        return "log-only"
