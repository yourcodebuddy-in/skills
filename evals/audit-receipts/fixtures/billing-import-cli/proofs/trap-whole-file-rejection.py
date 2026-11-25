"""Trap (followed-decision): ADR 0002 refuses a whole usage file for one bad row.

An auditor might call this fragile and suggest skipping bad rows. The ADR
records why (silent under-billing), and the code follows it: nothing is
written for a refused file, not even the batch record, and the batch and its
rows share one transaction. Exit 0 when all of that holds.
"""
import csv
import os
import sys
import tempfile
from datetime import UTC, datetime
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, os.getcwd())

from usagebill import migrations, repository
from usagebill import importer
from usagebill.db import connect
from usagebill.pricing import load_plans

adr = Path("docs/adr/0002-whole-file-imports.md").read_text()
assert "the whole file is refused" in adr and "one transaction" in adr

NOW = datetime(2026, 11, 20, tzinfo=UTC)


def counts(conn):
    return tuple(conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0] for t in ("usage_events", "import_batches"))


with tempfile.TemporaryDirectory() as tmp:
    conn = connect(Path(tmp) / "p.db")
    migrations.migrate(conn)
    plans = load_plans("config/plans.json")
    with conn:
        repository.add_customer(conn, account="northwind", name="Northwind", plan="starter", country="GB",
                                timezone="UTC", vat_id=None, discount=None, created_at="2026-01-01T00:00:00Z")

    def write(name, quantities):
        path = Path(tmp) / name
        with path.open("w", newline="") as handle:
            writer = csv.writer(handle)
            writer.writerow(["account", "metric", "quantity", "occurred_at"])
            for day, quantity in enumerate(quantities, start=1):
                writer.writerow(["northwind", "api_calls", quantity, f"2026-10-{day:02d}T00:00:00Z"])
        return path

    try:
        importer.import_file(conn, write("bad.csv", ["100", "200", "41,250"]), "northwind", plans, now=NOW)
        refused = False
    except importer.ImportRejected:
        refused = True
    after_refusal = counts(conn)

    # a failure while writing rolls back the batch record too
    original = repository.insert_usage

    def failing_insert(*args, **kwargs):
        raise RuntimeError("disk full")

    repository.insert_usage = failing_insert
    try:
        importer.import_file(conn, write("good.csv", ["100", "200", "41250"]), "northwind", plans, now=NOW)
        write_failure_raised = False
    except RuntimeError:
        write_failure_raised = True
    repository.insert_usage = original
    after_write_failure = counts(conn)

    fixed = importer.import_file(conn, write("good.csv", ["100", "200", "41250"]), "northwind", plans, now=NOW)
    after_fix = counts(conn)
    conn.close()
print(f"refused={refused} after refusal={after_refusal} after write failure={after_write_failure} after fix={after_fix} rows={fixed.rows}")
sys.exit(0 if refused and after_refusal == (0, 0) and write_failure_raised and after_write_failure == (0, 0) and after_fix == (3, 1) else 1)
