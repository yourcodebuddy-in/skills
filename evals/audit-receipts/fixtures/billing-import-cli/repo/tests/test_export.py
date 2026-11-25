import csv
import json
import unittest
from datetime import date

import helpers

from usagebill import invoices
from usagebill.export import export_period
from usagebill.importer import import_file


class ExportTests(helpers.DatabaseTestCase):
    def setUp(self):
        super().setUp()
        self.add_customer("northwind")
        self.add_customer("contoso", country="DE", vat_id="DE123456789")
        path = self.write_csv(
            "u.csv",
            [
                ("northwind", "api_calls", "30000", "2026-10-15T00:00:00Z"),
                ("northwind", "storage_gb", "100.5", "2026-10-15T00:00:00Z"),
            ],
        )
        import_file(self.conn, path, "northwind", self.plans, now=helpers.NOW)
        invoices.generate(self.conn, "2026-10", self.plans, today=date(2026, 11, 1))

    def read(self, path):
        with path.open(newline="", encoding="utf-8") as handle:
            return list(csv.reader(handle))

    def test_drafts_are_not_exported(self):
        written = export_period(self.conn, "2026-10", self.tmp / "out")
        self.assertEqual([p.name for p in written], ["summary.json"])

    def test_writes_one_file_per_invoice_and_a_summary(self):
        invoices.finalize(self.conn, "2026-10")
        out = self.tmp / "out"
        written = export_period(self.conn, "2026-10", out)
        self.assertEqual(
            sorted(p.name for p in written),
            ["202610-CONTOSO.csv", "202610-NORTHWIND.csv", "summary.json"],
        )
        summary = json.loads((out / "summary.json").read_text(encoding="utf-8"))
        self.assertEqual(summary["period"], "2026-10")
        self.assertEqual([i["number"] for i in summary["invoices"]], ["202610-CONTOSO", "202610-NORTHWIND"])

    def test_invoice_file_contents(self):
        invoices.finalize(self.conn, "2026-10")
        out = self.tmp / "out"
        export_period(self.conn, "2026-10", out)
        rows = self.read(out / "202610-NORTHWIND.csv")
        self.assertEqual(rows[0], ["Invoice", "202610-NORTHWIND"])
        self.assertEqual(rows[3], ["Period", "October 2026"])
        self.assertEqual(rows[4], ["Issued", "01 Nov 2026"])
        self.assertEqual(rows[5], ["Due", "01 Dec 2026"])
        self.assertIn(["Starter plan", "", "29.00"], rows)
        self.assertIn(["API calls", "30000", "10.00"], rows)
        # 100.5 GB-days at 1.5 cents = 150.75, rounded to 151
        self.assertIn(["Storage (GB-days)", "100.5", "1.51"], rows)
        self.assertIn(["Subtotal", "", "40.51"], rows)
        self.assertIn(["Tax (20%)", "", "8.10"], rows)
        self.assertEqual(rows[-1], ["Total", "", "48.61"])

    def test_reverse_charge_invoice(self):
        invoices.finalize(self.conn, "2026-10")
        out = self.tmp / "out"
        export_period(self.conn, "2026-10", out)
        rows = self.read(out / "202610-CONTOSO.csv")
        self.assertIn(["Tax (0%)", "", "0.00"], rows)
        self.assertEqual(rows[-1], ["Total", "", "29.00"])


if __name__ == "__main__":
    unittest.main()
