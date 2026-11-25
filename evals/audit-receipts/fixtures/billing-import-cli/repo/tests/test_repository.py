import unittest
from datetime import date

import helpers

from usagebill import invoices, repository


class ListInvoicesTests(helpers.DatabaseTestCase):
    def setUp(self):
        super().setUp()
        for account in ("northwind", "contoso", "fabrikam"):
            self.add_customer(account)
        invoices.generate(self.conn, "2026-09", self.plans, today=date(2026, 10, 1))
        invoices.finalize(self.conn, "2026-09")
        invoices.generate(self.conn, "2026-10", self.plans, today=date(2026, 11, 1))

    def numbers(self, **kwargs):
        return [row["number"] for row in repository.list_invoices(self.conn, **kwargs)]

    def test_default_sort_is_period_then_id(self):
        self.assertEqual(
            self.numbers(),
            [
                "202609-CONTOSO",
                "202609-FABRIKAM",
                "202609-NORTHWIND",
                "202610-CONTOSO",
                "202610-FABRIKAM",
                "202610-NORTHWIND",
            ],
        )

    def test_filter_by_status(self):
        self.assertEqual(self.numbers(status="finalized"), ["202609-CONTOSO", "202609-FABRIKAM", "202609-NORTHWIND"])
        self.assertEqual(self.numbers(status="sent"), [])

    def test_sort_by_account_descending(self):
        self.assertEqual(
            self.numbers(sort="account", descending=True)[:2],
            ["202609-NORTHWIND", "202610-NORTHWIND"],
        )

    def test_unknown_sort_is_refused(self):
        for sort in ("created_at", "period; DROP TABLE invoices", ""):
            with self.subTest(sort=sort), self.assertRaises(ValueError):
                repository.list_invoices(self.conn, sort=sort)


if __name__ == "__main__":
    unittest.main()
