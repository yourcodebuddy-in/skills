import unittest
from types import SimpleNamespace
from unittest.mock import patch

from billing.gateway import GatewayTimeout
from billing.service import charge_order


class FakeOrders:
    def __init__(self):
        self.order = SimpleNamespace(customer_id="c1", amount_cents=500)
        self.paid_with = None

    def get(self, order_id):
        return self.order

    def mark_paid(self, order_id, receipt):
        self.paid_with = receipt


class FakeGateway:
    def __init__(self, timeouts=0):
        self.timeouts = timeouts

    def charge(self, customer_id, amount_cents, idempotency_key=None):
        if self.timeouts > 0:
            self.timeouts -= 1
            raise GatewayTimeout()
        return "rcpt_1"


class ChargeOrderTest(unittest.TestCase):
    def test_marks_order_paid(self):
        orders = FakeOrders()
        self.assertEqual(charge_order(FakeGateway(), orders, "o1"), "rcpt_1")
        self.assertEqual(orders.paid_with, "rcpt_1")

    @patch("billing.service.time.sleep")
    def test_retries_after_timeout(self, _sleep):
        orders = FakeOrders()
        self.assertEqual(charge_order(FakeGateway(timeouts=2), orders, "o1"), "rcpt_1")


if __name__ == "__main__":
    unittest.main()
