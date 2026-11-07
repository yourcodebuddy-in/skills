import unittest

from reports.cache import clear
from reports.summary import monthly_summary


class FakeDb:
    def __init__(self):
        self.calls = 0

    def invoices_for(self, tenant_id, month):
        self.calls += 1
        return [{"cents": 500}, {"cents": 700}]


class SummaryTest(unittest.TestCase):
    def setUp(self):
        clear()

    def test_totals(self):
        self.assertEqual(monthly_summary(FakeDb(), "t1", "2026-01"), {"count": 2, "total_cents": 1200})


if __name__ == "__main__":
    unittest.main()
