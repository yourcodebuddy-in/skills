"""Each retry sends a new Idempotency-Key, contrary to ADR 0003.

Exit 0 when a timeout followed by a retry sends two different keys, neither
of which is the invoice number the ADR requires.
"""
import os
import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, os.getcwd())

from usagebill.webhook import post_invoice

adr = Path("docs/adr/0003-idempotent-webhook-posts.md").read_text()
assert "Retries of the same invoice send the same key" in adr
assert "`Idempotency-Key` set to the invoice number" in adr

keys = []


def send(url, body, headers, timeout):
    keys.append(headers["Idempotency-Key"])
    if len(keys) == 1:
        raise TimeoutError("timed out after the server stored the invoice")
    return 200


ok = post_invoice("https://accounting.example.com/x", "t", {"number": "202610-NORTHWIND"}, send=send, sleep=lambda s: None)
print(f"accepted={ok}; keys sent: {keys}")
sys.exit(0 if ok and len(set(keys)) == 2 and "202610-NORTHWIND" not in keys else 1)
