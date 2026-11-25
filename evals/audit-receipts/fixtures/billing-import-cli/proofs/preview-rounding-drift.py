"""preview() rounds line amounts with round() (half-even); invoices use to_cents (half-up).

The per-line rounding rule is written twice. Exit 0 when the preview and the
invoice give different amounts for the same usage.
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

with tempfile.TemporaryDirectory() as tmp:
    conn = connect(Path(tmp) / "p.db")
    migrations.migrate(conn)
    plans = load_plans("config/plans.json")
    with conn:
        repository.add_customer(conn, account="northwind", name="Northwind", plan="starter", country="GB",
                                timezone="UTC", vat_id=None, discount=None, created_at="2026-01-01T00:00:00Z")
    path = Path(tmp) / "usage.csv"
    with path.open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["account", "metric", "quantity", "occurred_at"])
        # 22,330 calls - 10,000 included = 12,330 billable at 0.05 cents = 616.5 cents
        writer.writerow(["northwind", "api_calls", "22330", "2026-10-10T00:00:00Z"])
    import_file(conn, path, "northwind", plans, now=datetime(2026, 11, 20, tzinfo=UTC))
    estimate = invoices.preview(conn, "northwind", "2026-10", plans)
    invoices.generate(conn, "2026-10", plans, today=date(2026, 11, 1))
    row = repository.find_invoice(conn, 1, "2026-10")
    conn.close()
print(f"preview subtotal={estimate['subtotal_cents']} invoice subtotal={row['subtotal_cents']}")
sys.exit(0 if estimate["subtotal_cents"] == 2900 + 616 and row["subtotal_cents"] == 2900 + 617 else 1)
