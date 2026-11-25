import unittest
from decimal import Decimal

import helpers

from usagebill import repository
from usagebill.importer import ImportRejected, import_file, read_rows


def count(conn, table):
    return conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]


class ImportTests(helpers.DatabaseTestCase):
    def setUp(self):
        super().setUp()
        self.customer = self.add_customer("northwind")

    def import_rows(self, rows, name="usage.csv", **kwargs):
        path = self.write_csv(name, rows)
        return import_file(self.conn, path, "northwind", self.plans, now=helpers.NOW, **kwargs)

    def test_imports_valid_file(self):
        result = self.import_rows(
            [
                ("northwind", "api_calls", "41250", "2026-10-01T00:00:00Z"),
                ("northwind", "storage_gb", "12.5", "2026-10-01T00:00:00Z"),
                ("northwind", "api_calls", "100", "2026-10-02T09:30:00+01:00"),
            ]
        )
        self.assertEqual(result.rows, 3)
        self.assertFalse(result.dry_run)
        rows = self.conn.execute("SELECT metric, quantity, occurred_at FROM usage_events ORDER BY id").fetchall()
        self.assertEqual(
            [tuple(row) for row in rows],
            [
                ("api_calls", "41250", "2026-10-01T00:00:00Z"),
                ("storage_gb", "12.5", "2026-10-01T00:00:00Z"),
                ("api_calls", "100", "2026-10-02T08:30:00Z"),
            ],
        )
        batch = self.conn.execute("SELECT * FROM import_batches").fetchone()
        self.assertEqual(batch["customer_id"], self.customer.id)
        self.assertEqual(batch["row_count"], 3)

    def test_quantities_sum_exactly(self):
        self.import_rows(
            [
                ("northwind", "storage_gb", "0.1", "2026-10-01T00:00:00Z"),
                ("northwind", "storage_gb", "0.2", "2026-10-02T00:00:00Z"),
            ]
        )
        totals = repository.usage_totals(self.conn, self.customer.id, "2026-10-01T00:00:00Z", "2026-10-31T00:00:00Z")
        self.assertEqual(totals, {"storage_gb": Decimal("0.3")})

    def test_one_bad_row_refuses_the_file(self):
        with self.assertRaises(ImportRejected) as caught:
            self.import_rows(
                [
                    ("northwind", "api_calls", "10", "2026-10-01T00:00:00Z"),
                    ("northwind", "api_calls", "41,250", "2026-10-02T00:00:00Z"),
                ]
            )
        self.assertEqual(len(caught.exception.errors), 1)
        self.assertIn("line 3", caught.exception.errors[0])
        self.assertEqual(count(self.conn, "usage_events"), 0)
        self.assertEqual(count(self.conn, "import_batches"), 0)

    def test_reports_each_kind_of_problem(self):
        with self.assertRaises(ImportRejected) as caught:
            self.import_rows(
                [
                    ("nobody", "api_calls", "1", "2026-10-01T00:00:00Z"),
                    ("northwind", "seats", "1", "2026-10-01T00:00:00Z"),
                    ("northwind", "api_calls", "-1", "2026-10-01T00:00:00Z"),
                    ("northwind", "api_calls", "1", "2026-10-01"),
                    ("northwind", "api_calls", "1", "2027-01-01T00:00:00Z"),
                ]
            )
        errors = caught.exception.errors
        self.assertEqual(len(errors), 5)
        self.assertIn("unknown account", errors[0])
        self.assertIn("isn't billed", errors[1])
        self.assertIn("negative", errors[2])
        self.assertIn("no offset", errors[3])
        self.assertIn("future", errors[4])

    def test_error_list_is_capped(self):
        rows = [("northwind", "api_calls", "x", "2026-10-01T00:00:00Z")] * 25
        with self.assertRaises(ImportRejected) as caught:
            self.import_rows(rows)
        self.assertEqual(len(caught.exception.errors), 21)
        self.assertEqual(caught.exception.errors[-1], "and 5 more")

    def test_same_file_twice_is_refused(self):
        rows = [("northwind", "api_calls", "10", "2026-10-01T00:00:00Z")]
        self.import_rows(rows)
        with self.assertRaises(ImportRejected) as caught:
            self.import_rows(rows)
        self.assertIn("already imported", caught.exception.errors[0])
        self.assertEqual(count(self.conn, "usage_events"), 1)

    def test_dry_run_writes_nothing(self):
        result = self.import_rows([("northwind", "api_calls", "10", "2026-10-01T00:00:00Z")], dry_run=True)
        self.assertTrue(result.dry_run)
        self.assertEqual(result.rows, 1)
        self.assertIsNone(result.batch_id)
        self.assertEqual(count(self.conn, "usage_events"), 0)
        self.assertEqual(count(self.conn, "import_batches"), 0)
        # and the real import afterwards still works
        self.assertEqual(self.import_rows([("northwind", "api_calls", "10", "2026-10-01T00:00:00Z")]).rows, 1)

    def test_empty_file(self):
        with self.assertRaises(ImportRejected) as caught:
            self.import_rows([])
        self.assertIn("no usage rows", caught.exception.errors[0])


class ReadRowsTests(helpers.DatabaseTestCase):
    def test_missing_columns(self):
        path = self.write_csv("bad.csv", [("a", "b")], header=("account", "metric"))
        with self.assertRaises(ImportRejected) as caught:
            read_rows(path)
        self.assertIn("quantity, occurred_at", caught.exception.errors[0])

    def test_header_whitespace_bom_and_blank_lines(self):
        path = self.tmp / "bom.csv"
        path.write_text(
            "﻿ account , metric,quantity,occurred_at\n\nnorthwind,api_calls,5,2026-10-01T00:00:00Z\n,,,\n",
            encoding="utf-8",
        )
        rows = read_rows(path)
        self.assertEqual(len(rows), 1)
        line_no, row = rows[0]
        self.assertEqual(line_no, 3)
        self.assertEqual(row["account"], "northwind")


if __name__ == "__main__":
    unittest.main()
