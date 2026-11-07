import unittest

from etl.revenue import revenue_by_region, total_revenue


class RevenueTest(unittest.TestCase):
    def test_total(self):
        self.assertEqual(total_revenue([{"cents": 5}, {"cents": 7}]), 12)

    def test_by_region(self):
        orders = [{"customer_id": 1, "cents": 100}]
        addresses = [{"customer_id": 1, "region": "EU", "is_primary": True}]
        self.assertEqual(revenue_by_region(orders, addresses), {"EU": 100})


if __name__ == "__main__":
    unittest.main()
