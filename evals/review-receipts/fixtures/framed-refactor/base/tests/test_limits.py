import unittest

from risk.limits import can_transfer, needs_review


class LimitsTest(unittest.TestCase):
    def test_transfer_within_limit(self):
        self.assertTrue(can_transfer(0, 100))

    def test_transfer_over_limit(self):
        self.assertFalse(can_transfer(90_000, 20_000))

    def test_review_for_large_amounts(self):
        self.assertTrue(needs_review(60_000))


if __name__ == "__main__":
    unittest.main()
