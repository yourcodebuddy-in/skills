import logging
import time

logger = logging.getLogger(__name__)


def poll_once(fetch, handle):
    started = time.monotonic()
    items = fetch()
    for item in items:
        handle(item)
    elapsed_ms = (time.monotonic() - started) * 1000
    logger.info("handled %d items in %.0f seconds", len(items), elapsed_ms)
    return len(items)
