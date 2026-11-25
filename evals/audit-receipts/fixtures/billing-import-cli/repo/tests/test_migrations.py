import tempfile
import unittest
from pathlib import Path

import helpers  # noqa: F401

from usagebill import migrations
from usagebill.db import connect


def tables(conn):
    rows = conn.execute("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").fetchall()
    return [row[0] for row in rows]


def columns(conn, table):
    return [row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()]


class MigrationTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.conn = connect(Path(self._tmp.name) / "m.db")

    def tearDown(self):
        self.conn.close()
        self._tmp.cleanup()

    def test_fresh_database(self):
        self.assertEqual(migrations.migrate(self.conn), [1, 2, 3, 4])
        self.assertEqual(migrations.current_version(self.conn), migrations.LATEST_VERSION)
        self.assertEqual(
            tables(self.conn),
            ["customers", "import_batches", "invoice_lines", "invoices", "usage_events"],
        )
        self.assertIn("sent_at", columns(self.conn, "invoices"))
        self.assertIn("timezone", columns(self.conn, "customers"))

    def test_running_again_does_nothing(self):
        migrations.migrate(self.conn)
        self.assertEqual(migrations.migrate(self.conn), [])

    def test_foreign_keys_are_back_on(self):
        migrations.migrate(self.conn)
        self.assertEqual(self.conn.execute("PRAGMA foreign_keys").fetchone()[0], 1)

    def test_upgrade_keeps_customers(self):
        migrations.migrate(self.conn, target=2)
        self.conn.execute(
            "INSERT INTO customers (account, name, plan, country, created_at) VALUES ('northwind', 'Northwind', 'starter', 'GB', 'x')"
        )
        self.conn.commit()
        self.assertEqual(migrations.migrate(self.conn), [3, 4])
        row = self.conn.execute("SELECT * FROM customers").fetchone()
        self.assertEqual(row["account"], "northwind")
        self.assertEqual(row["timezone"], "UTC")
        self.assertIsNone(row["discount"])

    def test_upgrade_adds_unique_period_constraint(self):
        migrations.migrate(self.conn, target=3)
        migrations.migrate(self.conn)
        indexes = self.conn.execute("PRAGMA index_list(invoices)").fetchall()
        unique = [row["name"] for row in indexes if row["unique"]]
        cols = [
            [c["name"] for c in self.conn.execute(f"PRAGMA index_info({name})").fetchall()]
            for name in unique
        ]
        self.assertIn(["customer_id", "period"], cols)

    def test_failed_migration_rolls_back(self):
        migrations.migrate(self.conn, target=1)
        self.conn.execute("CREATE TABLE invoices (id INTEGER PRIMARY KEY)")
        self.conn.commit()
        with self.assertRaises(Exception):
            migrations.migrate(self.conn)
        self.assertEqual(migrations.current_version(self.conn), 1)


if __name__ == "__main__":
    unittest.main()
