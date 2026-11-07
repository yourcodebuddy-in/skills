import time

_entries = {}


def get_or_set(key, ttl_seconds, compute):
    now = time.monotonic()
    hit = _entries.get(key)
    if hit and hit[0] > now:
        return hit[1]
    value = compute()
    _entries[key] = (now + ttl_seconds, value)
    return value


def clear():
    _entries.clear()
