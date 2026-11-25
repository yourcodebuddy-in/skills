"""Shared test setup: a temporary migrated database and sample plans."""

import csv
import sys
import tempfile
import unittest
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from usagebill import migrations, repository  # noqa: E402
from usagebill.db import connect  # noqa: E402
from usagebill.pricing import parse_plans  # noqa: E402

PLANS_DATA = {
    "starter": {
        "name": "Starter",
        "currency": "GBP",
        "base_cents": 2900,
        "metrics": {
            "api_calls": {"label": "API calls", "unit_cents": "0.05", "included": "10000"},
            "storage_gb": {"label": "Storage (GB-days)", "unit_cents": "1.5"},
        },
    },
    "growth": {
        "name": "Growth",
        "currency": "GBP",
        "base_cents": 9900,
        "metrics": {
            "api_calls": {"label": "API calls", "unit_cents": "0.03", "included": "100000"},
            "seats": {"label": "Extra seats", "unit_cents": "800", "included": "5"},
        },
    },
}

NOW = datetime(2026, 11, 20, 12, 0, tzinfo=UTC)


def plans():
    return parse_plans(PLANS_DATA)


class DatabaseTestCase(unittest.TestCase):
    """Gives each test a fresh migrated database in a temporary folder."""

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp = Path(self._tmp.name)
        self.db_path = self.tmp / "test.db"
        self.conn = connect(self.db_path)
        migrations.migrate(self.conn)
        self.plans = plans()

    def tearDown(self):
        self.conn.close()
        self._tmp.cleanup()

    def add_customer(self, account="northwind", plan="starter", country="GB", timezone="UTC", vat_id=None, discount=None):
        with self.conn:
            repository.add_customer(
                self.conn,
                account=account,
                name=account.title(),
                plan=plan,
                country=country,
                timezone=timezone,
                vat_id=vat_id,
                discount=discount,
                created_at="2026-01-01T00:00:00Z",
            )
        return repository.get_customer(self.conn, account)

    def write_csv(self, name, rows, header=("account", "metric", "quantity", "occurred_at")):
        path = self.tmp / name
        with path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            writer.writerow(header)
            writer.writerows(rows)
        return path
