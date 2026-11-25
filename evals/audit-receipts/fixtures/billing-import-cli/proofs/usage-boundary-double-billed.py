"""Usage stamped exactly at midnight on the 1st is billed in two months.

usage_totals compares with `occurred_at <= end`, and end is the first instant
of the next month. Exit 0 when one row appears on both invoices.
"""
import csv
import os
import sys
import tempfile
from datetime import UTC, date, datetime
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, os.getcwd())

from usagebill import invoices, migrations, repository
from usagebill.db import connect
from usagebill.importer import import_file
from usagebill.pricing import load_plans

NOW = datetime(2026, 12, 20, tzinfo=UTC)

with tempfile.TemporaryDirectory() as tmp:
    conn = connect(Path(tmp) / "p.db")
    migrations.migrate(conn)
    plans = load_plans("config/plans.json")
    with conn:
        repository.add_customer(conn, account="northwind", name="Northwind", plan="starter", country="GB",
                                timezone="UTC", vat_id=None, discount=None, created_at="2026-01-01T00:00:00Z")
    customer = repository.get_customer(conn, "northwind")
    path = Path(tmp) / "usage.csv"
    with path.open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["account", "metric", "quantity", "occurred_at"])
        # the daily row for 1 November, stamped at midnight UTC as the README describes
        writer.writerow(["northwind", "api_calls", "50000", "2026-11-01T00:00:00Z"])
    import_file(conn, path, "northwind", plans, now=NOW)

    invoices.generate(conn, "2026-10", plans, today=date(2026, 11, 1), now=NOW)
    invoices.generate(conn, "2026-11", plans, today=date(2026, 12, 1), now=NOW)
    billed = {}
    for period in ("2026-10", "2026-11"):
        row = repository.find_invoice(conn, customer.id, period)
        lines = repository.invoice_lines(conn, row["id"])
        billed[period] = [(l.metric, l.quantity, l.amount_cents) for l in lines if l.metric]
        print(period, billed[period])
    conn.close()
both = all(any(m == "api_calls" for m, _, _ in billed[p]) for p in billed)
sys.exit(0 if both else 1)
