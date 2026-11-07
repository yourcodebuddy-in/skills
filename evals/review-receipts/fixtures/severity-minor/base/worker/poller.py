import logging
import time

logger = logging.getLogger(__name__)


def poll_once(fetch, handle):
    items = fetch()
    for item in items:
        handle(item)
    return len(items)
