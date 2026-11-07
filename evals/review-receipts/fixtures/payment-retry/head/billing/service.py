import logging
import time

from billing.gateway import GatewayTimeout

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 3
BACKOFF_SECONDS = 0.5


def _charge_with_retry(gateway, order):
    for attempt in range(MAX_ATTEMPTS):
        try:
            return gateway.charge(order.customer_id, order.amount_cents)
        except GatewayTimeout:
            logger.warning("charge timed out, attempt %s of %s", attempt + 1, MAX_ATTEMPTS)
            time.sleep(BACKOFF_SECONDS * (attempt + 1))
    return None


def charge_order(gateway, orders, order_id):
    order = orders.get(order_id)
    receipt = _charge_with_retry(gateway, order)
    orders.mark_paid(order_id, receipt)
    return receipt
