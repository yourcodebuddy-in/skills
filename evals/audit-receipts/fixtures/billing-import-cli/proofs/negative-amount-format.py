"""format_cents gets negative amounts wrong, so exported discount lines are wrong.

divmod floors toward minus infinity: divmod(-150, 100) == (-2, 50), giving
"-2.50" for -1.50. Exit 0 when an exported invoice shows the discount line
as -2.50 while its own summary row says -1.50.
"""
import csv
import os
import sys
import tempfile
from datetime import date
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, os.getcwd())

from usagebill import invoices, migrations, repository
from usagebill.db import connect
from usagebill.export import export_period
from usagebill.formatting import format_cents
from usagebill.pricing import load_plans

print(f"format_cents(-150) = {format_cents(-150)!r}; format_cents(-5) = {format_cents(-5)!r}")
with tempfile.TemporaryDirectory() as tmp:
    conn = connect(Path(tmp) / "p.db")
    migrations.migrate(conn)
    plans = load_plans("config/plans.json")
    with conn:
        repository.add_customer(conn, account="northwind", name="Northwind", plan="starter", country="GB",
                                timezone="UTC", vat_id=None, discount="fixed:150", created_at="2026-01-01T00:00:00Z")
    invoices.generate(conn, "2026-10", plans, today=date(2026, 11, 1))
    invoices.finalize(conn, "2026-10")
    export_period(conn, "2026-10", Path(tmp) / "out")
    with (Path(tmp) / "out" / "202610-NORTHWIND.csv").open(newline="") as handle:
        rows = list(csv.reader(handle))
    conn.close()
discount_rows = [r for r in rows if r and r[0] == "Discount"]
print(discount_rows)
sys.exit(0 if ["Discount", "", "-2.50"] in discount_rows and ["Discount", "", "-1.50"] in discount_rows else 1)
