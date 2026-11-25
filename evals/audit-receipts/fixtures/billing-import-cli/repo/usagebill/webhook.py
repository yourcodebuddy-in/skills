"""Posting finalized invoices to the accounting system."""

import json
import logging
import sqlite3
import time
import urllib.error
import urllib.request
from collections.abc import Callable

from usagebill import constants
from usagebill.models import InvoiceLine

log = logging.getLogger(__name__)

Send = Callable[[str, bytes, dict[str, str], float], int]
Sleep = Callable[[float], None]


class WebhookRejected(Exception):
    """Raised when the accounting system refuses an invoice outright."""


def http_send(url: str, body: bytes, headers: dict[str, str], timeout: float) -> int:
    request = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status
    except urllib.error.HTTPError as exc:
        return exc.code


def invoice_payload(invoice: sqlite3.Row, lines: list[InvoiceLine]) -> dict:
    return {
        "number": invoice["number"],
        "account": invoice["account"],
        "customer_name": invoice["customer_name"],
        "period": invoice["period"],
        "issued_on": invoice["issued_on"],
        "due_on": invoice["due_on"],
        "subtotal_cents": invoice["subtotal_cents"],
        "discount_cents": invoice["discount_cents"],
        "tax_rate": invoice["tax_rate"],
        "tax_cents": invoice["tax_cents"],
        "total_cents": invoice["total_cents"],
        "lines": [
            {
                "description": line.description,
                "metric": line.metric,
                "quantity": None if line.quantity is None else str(line.quantity),
                "amount_cents": line.amount_cents,
            }
            for line in lines
        ],
    }


def _headers(token: str, request_id: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Idempotency-Key": request_id,
        "User-Agent": constants.USER_AGENT,
    }


def _backoff(attempt: int) -> float:
    delays = constants.WEBHOOK_BACKOFF_SECONDS
    return delays[min(attempt, len(delays)) - 1]


def post_invoice(
    url: str,
    token: str,
    payload: dict,
    *,
    send: Send = http_send,
    sleep: Sleep = time.sleep,
) -> bool:
    """Post one invoice, retrying on network errors, 429 and 5xx.

    Returns True once the accounting system accepts it, False if every attempt
    failed. Raises WebhookRejected for any other 4xx.
    """
    body = json.dumps(payload, sort_keys=True).encode("utf-8")
    number = payload["number"]
    for attempt in range(1, constants.WEBHOOK_MAX_ATTEMPTS + 1):
        request_id = f"{number}-{attempt}"
        try:
            status = send(url, body, _headers(token, request_id), constants.WEBHOOK_TIMEOUT_SECONDS)
        except OSError as exc:
            log.warning("posting %s failed on attempt %d: %s", number, attempt, exc)
            status = None
        if status is not None and 200 <= status < 300:
            return True
        if status is not None and 400 <= status < 500 and status != 429:
            raise WebhookRejected(f"accounting system refused {number} with HTTP {status}")
        if status is not None:
            log.warning("posting %s got HTTP %d on attempt %d", number, status, attempt)
        if attempt < constants.WEBHOOK_MAX_ATTEMPTS:
            sleep(_backoff(attempt))
    log.error("giving up on %s after %d attempts", number, constants.WEBHOOK_MAX_ATTEMPTS)
    return False
