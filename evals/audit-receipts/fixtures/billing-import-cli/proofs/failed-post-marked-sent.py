"""send_finalized ignores post_invoice's False result and marks the invoice sent.

Exit 0 when every attempt fails (HTTP 503) yet the invoice ends up 'sent'
and the command reports it as sent.
"""
import os
import sys
import tempfile
from datetime import date
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, os.getcwd())

import logging

logging.disable(logging.CRITICAL)

from usagebill import invoices, migrations, repository
from usagebill.config import Settings
from usagebill.db import connect
from usagebill.pricing import load_plans

attempts = []


def always_unavailable(url, body, headers, timeout):
    attempts.append(1)
    return 503


with tempfile.TemporaryDirectory() as tmp:
    conn = connect(Path(tmp) / "p.db")
    migrations.migrate(conn)
    plans = load_plans("config/plans.json")
    with conn:
        repository.add_customer(conn, account="northwind", name="Northwind", plan="starter", country="GB",
                                timezone="UTC", vat_id=None, discount=None, created_at="2026-01-01T00:00:00Z")
    invoices.generate(conn, "2026-10", plans, today=date(2026, 11, 1))
    invoices.finalize(conn, "2026-10")
    settings = Settings("unused", "unused", "INFO", webhook_url="https://accounting.example.com/x", webhook_token="t")
    count = invoices.send_finalized(conn, settings, send=always_unavailable, sleep=lambda s: None)
    status = conn.execute("SELECT status, sent_at FROM invoices").fetchone()
    pending = repository.invoices_by_status(conn, "finalized")
    conn.close()
print(f"attempts={len(attempts)} reported_sent={count} status={status['status']} sent_at={status['sent_at']} still_pending={len(pending)}")
sys.exit(0 if len(attempts) == 4 and count == 1 and status["status"] == "sent" and not pending else 1)
