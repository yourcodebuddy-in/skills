import unittest

from etl.revenue import total_revenue


class RevenueTest(unittest.TestCase):
    def test_total(self):
        self.assertEqual(total_revenue([{"cents": 5}, {"cents": 7}]), 12)


if __name__ == "__main__":
    unittest.main()
