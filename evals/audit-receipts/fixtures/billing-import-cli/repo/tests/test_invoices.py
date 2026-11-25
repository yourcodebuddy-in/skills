import unittest
from datetime import date
from decimal import Decimal

import helpers

from usagebill import invoices, repository
from usagebill.importer import import_file
from usagebill.models import Customer

TODAY = date(2026, 11, 1)


def customer(**overrides):
    values = dict(
        id=1,
        account="northwind",
        name="Northwind",
        plan="starter",
        country="GB",
        vat_id=None,
        timezone="UTC",
        discount=None,
    )
    values.update(overrides)
    return Customer(**values)


class BuildInvoiceTests(unittest.TestCase):
    def setUp(self):
        self.plan = helpers.plans()["starter"]

    def test_base_fee_only(self):
        invoice = invoices.build_invoice(customer(), self.plan, "2026-10", {}, TODAY)
        self.assertEqual(invoice.number, "202610-NORTHWIND")
        self.assertEqual(invoice.subtotal_cents, 2900)
        self.assertEqual(invoice.tax_cents, 580)
        self.assertEqual(invoice.total_cents, 3480)
        self.assertEqual(invoice.due_on, date(2026, 12, 1))

    def test_usage_discount_and_tax(self):
        totals = {"api_calls": Decimal("30000"), "storage_gb": Decimal("100")}
        invoice = invoices.build_invoice(customer(discount="percent:10"), self.plan, "2026-10", totals, TODAY)
        # 2900 base + 1000 calls + 150 storage = 4050; 10% off = 405; tax 20% of 3645 = 729
        self.assertEqual(invoice.subtotal_cents, 4050)
        self.assertEqual(invoice.discount_cents, 405)
        self.assertEqual(invoice.tax_cents, 729)
        self.assertEqual(invoice.total_cents, 4374)
        self.assertEqual(invoice.lines[-1].description, "Discount")
        self.assertEqual(invoice.lines[-1].amount_cents, -405)
        self.assertEqual(sum(line.amount_cents for line in invoice.lines), invoice.subtotal_cents - invoice.discount_cents)

    def test_reverse_charge(self):
        invoice = invoices.build_invoice(customer(country="DE", vat_id="DE123"), self.plan, "2026-10", {}, TODAY)
        self.assertEqual(invoice.tax_rate, Decimal("0"))
        self.assertEqual(invoice.total_cents, 2900)


class GenerateTests(helpers.DatabaseTestCase):
    def setUp(self):
        super().setUp()
        self.customer = self.add_customer("northwind")

    def load(self, rows, name="usage.csv", account="northwind"):
        path = self.write_csv(name, rows)
        import_file(self.conn, path, account, self.plans, now=helpers.NOW)

    def invoice_row(self, period="2026-10", customer_id=None):
        return repository.find_invoice(self.conn, customer_id or self.customer.id, period)

    def test_generate_bills_only_that_month(self):
        self.load(
            [
                ("northwind", "api_calls", "30000", "2026-10-15T00:00:00Z"),
                ("northwind", "api_calls", "50000", "2026-09-20T00:00:00Z"),
                ("northwind", "api_calls", "70000", "2026-11-03T00:00:00Z"),
            ]
        )
        result = invoices.generate(self.conn, "2026-10", self.plans, today=TODAY)
        self.assertEqual(result.created, ["202610-NORTHWIND"])
        row = self.invoice_row()
        self.assertEqual(row["subtotal_cents"], 3900)
        self.assertEqual(row["status"], "draft")
        lines = repository.invoice_lines(self.conn, row["id"])
        self.assertEqual([line.amount_cents for line in lines], [2900, 1000])
        self.assertEqual(lines[1].quantity, Decimal("30000"))

    def test_generate_uses_customer_time_zone(self):
        tokyo = self.add_customer("tokyo-co", timezone="Asia/Tokyo")
        # 2026-10-31T16:00Z is 1 November 01:00 in Tokyo
        self.load(
            [
                ("tokyo-co", "api_calls", "30000", "2026-10-31T16:00:00Z"),
                ("tokyo-co", "api_calls", "20000", "2026-10-31T14:00:00Z"),
            ],
            account="tokyo-co",
        )
        invoices.generate(self.conn, "2026-10", self.plans, account="tokyo-co", today=TODAY)
        row = self.invoice_row(customer_id=tokyo.id)
        self.assertEqual(row["subtotal_cents"], 2900 + 500)

    def test_rerun_replaces_draft(self):
        self.load([("northwind", "api_calls", "30000", "2026-10-15T00:00:00Z")])
        invoices.generate(self.conn, "2026-10", self.plans, today=TODAY)
        self.load([("northwind", "api_calls", "20000", "2026-10-16T00:00:00Z")], name="late.csv")
        result = invoices.generate(self.conn, "2026-10", self.plans, today=TODAY)
        self.assertEqual(result.replaced, ["202610-NORTHWIND"])
        self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM invoices").fetchone()[0], 1)
        self.assertEqual(self.invoice_row()["subtotal_cents"], 2900 + 2000)

    def test_finalized_invoice_is_left_alone(self):
        self.load([("northwind", "api_calls", "30000", "2026-10-15T00:00:00Z")])
        invoices.generate(self.conn, "2026-10", self.plans, today=TODAY)
        self.assertEqual(invoices.finalize(self.conn, "2026-10"), 1)
        self.load([("northwind", "api_calls", "20000", "2026-10-16T00:00:00Z")], name="late.csv")
        result = invoices.generate(self.conn, "2026-10", self.plans, today=TODAY)
        self.assertEqual(result.skipped, ["202610-NORTHWIND"])
        row = self.invoice_row()
        self.assertEqual(row["status"], "finalized")
        self.assertEqual(row["subtotal_cents"], 3900)
        self.assertEqual(len(repository.invoice_lines(self.conn, row["id"])), 2)

    def test_generate_one_account(self):
        self.add_customer("contoso")
        result = invoices.generate(self.conn, "2026-10", self.plans, account="contoso", today=TODAY)
        self.assertEqual(result.created, ["202610-CONTOSO"])
        with self.assertRaises(LookupError):
            invoices.generate(self.conn, "2026-10", self.plans, account="ghost", today=TODAY)


class PreviewTests(helpers.DatabaseTestCase):
    def test_preview_matches_usage_so_far(self):
        self.add_customer("northwind")
        path = self.write_csv(
            "usage.csv",
            [
                ("northwind", "api_calls", "30000", "2026-11-02T00:00:00Z"),
                ("northwind", "storage_gb", "100", "2026-11-02T00:00:00Z"),
            ],
        )
        import_file(self.conn, path, "northwind", self.plans, now=helpers.NOW)
        estimate = invoices.preview(self.conn, "northwind", "2026-11", self.plans)
        self.assertEqual([line["amount_cents"] for line in estimate["lines"]], [2900, 1000, 150])
        self.assertEqual(estimate["subtotal_cents"], 4050)
        self.assertEqual(estimate["currency"], "GBP")


if __name__ == "__main__":
    unittest.main()
