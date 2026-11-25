"""SMS provider client. The provider takes the account key as a query parameter."""

from __future__ import annotations

import json
import logging
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

log = logging.getLogger(__name__)


class DeliveryFailed(Exception):
    pass


class SmsGateway:
    def __init__(self, base_url: str, api_key: str, sender: str, *, timeout: float = 10.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.sender = sender
        self.timeout = timeout

    def send(self, to: str, body: str) -> str:
        """Send one text message and return the provider's message id."""
        url = f"{self.base_url}/v1/messages?api_key={quote(self.api_key)}"
        data = json.dumps({"from": self.sender, "to": to, "body": body}).encode()
        request = Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urlopen(request, timeout=self.timeout) as response:
                payload = json.load(response)
        except (HTTPError, URLError, TimeoutError, ValueError) as exc:
            log.warning("SMS request %s failed: %s", url, exc)
            raise DeliveryFailed(str(exc)) from exc
        return str(payload.get("id", ""))


class LogOnlySms:
    """Used when no provider is configured, as in development: messages go to the log."""

    def send(self, to: str, body: str) -> str:
        log.info("SMS (not sent, no provider configured) to %s: %s", to, body)
        return "log-only"
