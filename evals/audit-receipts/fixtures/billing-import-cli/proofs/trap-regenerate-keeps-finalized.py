"""Trap (true-claim): README says rerunning `invoice generate` replaces drafts
in place and never changes a finalized or sent invoice.

The upsert in repository.save_draft only updates when `invoices.status =
'draft'` and returns no id otherwise, and generate() then skips the lines.
Exit 0 when the claim holds for draft, finalized and sent invoices.
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

NOW = datetime(2026, 11, 20, tzinfo=UTC)


def snapshot(conn, customer_id):
    row = repository.find_invoice(conn, customer_id, "2026-10")
    lines = [(l.description, l.amount_cents) for l in repository.invoice_lines(conn, row["id"])]
    return dict(row), lines


with tempfile.TemporaryDirectory() as tmp:
    conn = connect(Path(tmp) / "p.db")
    migrations.migrate(conn)
    plans = load_plans("config/plans.json")
    with conn:
        repository.add_customer(conn, account="northwind", name="Northwind", plan="starter", country="GB",
                                timezone="UTC", vat_id=None, discount=None, created_at="2026-01-01T00:00:00Z")
    cid = repository.get_customer(conn, "northwind").id

    def load(name, quantity, day):
        path = Path(tmp) / name
        with path.open("w", newline="") as handle:
            writer = csv.writer(handle)
            writer.writerow(["account", "metric", "quantity", "occurred_at"])
            writer.writerow(["northwind", "api_calls", quantity, f"2026-10-{day:02d}T12:00:00Z"])
        import_file(conn, path, "northwind", plans, now=NOW)

    load("a.csv", "30000", 5)
    first = invoices.generate(conn, "2026-10", plans, today=date(2026, 11, 1))
    load("b.csv", "20000", 6)
    second = invoices.generate(conn, "2026-10", plans, today=date(2026, 11, 1))
    count = conn.execute("SELECT COUNT(*) FROM invoices").fetchone()[0]
    draft_ok = first.created and second.replaced and count == 1 and snapshot(conn, cid)[0]["subtotal_cents"] == 2900 + 2000

    invoices.finalize(conn, "2026-10")
    before = snapshot(conn, cid)
    load("c.csv", "40000", 7)
    third = invoices.generate(conn, "2026-10", plans, today=date(2026, 11, 2))
    finalized_ok = third.skipped == ["202610-NORTHWIND"] and snapshot(conn, cid) == before

    with conn:
        repository.mark_sent(conn, before[0]["id"], "2026-11-04T06:00:00Z")
    sent_before = snapshot(conn, cid)
    load("d.csv", "10000", 8)
    fourth = invoices.generate(conn, "2026-10", plans, today=date(2026, 11, 5))
    sent_ok = fourth.skipped == ["202610-NORTHWIND"] and snapshot(conn, cid) == sent_before
    conn.close()
print(f"draft replaced in place: {bool(draft_ok)}; finalized untouched: {finalized_ok}; sent untouched: {sent_ok}")
sys.exit(0 if draft_ok and finalized_ok and sent_ok else 1)
