"""A file imported for one account can add usage to a different account.

Run from the root of a copy of repo/. Exit 0 when usage from northwind's
upload lands on contoso's invoice.
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

with tempfile.TemporaryDirectory() as tmp:
    conn = connect(Path(tmp) / "p.db")
    migrations.migrate(conn)
    plans = load_plans("config/plans.json")
    with conn:
        for account in ("northwind", "contoso"):
            repository.add_customer(conn, account=account, name=account, plan="starter", country="GB",
                                    timezone="UTC", vat_id=None, discount=None, created_at="2026-01-01T00:00:00Z")
    northwind = repository.get_customer(conn, "northwind")
    contoso = repository.get_customer(conn, "contoso")

    # northwind uploads a file whose rows name contoso
    path = Path(tmp) / "northwind-upload.csv"
    with path.open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["account", "metric", "quantity", "occurred_at"])
        writer.writerow(["contoso", "api_calls", "5000000", "2026-10-10T00:00:00Z"])
    result = import_file(conn, path, "northwind", plans, now=NOW)

    batch = conn.execute("SELECT customer_id FROM import_batches WHERE id = ?", (result.batch_id,)).fetchone()
    owners = {row[0] for row in conn.execute("SELECT customer_id FROM usage_events WHERE batch_id = ?", (result.batch_id,))}
    invoices.generate(conn, "2026-10", plans, today=date(2026, 11, 1), now=NOW)
    contoso_invoice = repository.find_invoice(conn, contoso.id, "2026-10")
    print(f"batch owner={batch[0]} (northwind={northwind.id}); usage rows belong to {owners} (contoso={contoso.id})")
    print(f"contoso October subtotal: {contoso_invoice['subtotal_cents']} cents")
    conn.close()
    ok = batch[0] == northwind.id and owners == {contoso.id} and contoso_invoice["subtotal_cents"] > 2900
sys.exit(0 if ok else 1)
