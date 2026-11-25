import unittest
from datetime import datetime, timedelta, timezone

from clinicbook import fees
from clinicbook.formatting import format_money, format_slot

START = datetime(2026, 3, 4, 14, 0, tzinfo=timezone.utc)


class FeeTest(unittest.TestCase):
    def test_percentages_round_half_up_to_the_cent(self):
        self.assertEqual(fees.percent_of(4505, 50), 2253)
        self.assertEqual(fees.percent_of(4504, 50), 2252)
        self.assertEqual(fees.percent_of(9999, 100), 9999)

    def test_cancelling_exactly_a_day_ahead_is_free(self):
        self.assertTrue(fees.cancellation_is_free(START, START - timedelta(hours=24)))
        self.assertFalse(fees.cancellation_is_free(START, START - timedelta(hours=23, minutes=59)))

    def test_late_cancel_fee(self):
        self.assertEqual(fees.late_cancel_fee(12000, START, START - timedelta(hours=30)), 0)
        self.assertEqual(fees.late_cancel_fee(12000, START, START - timedelta(hours=2)), 6000)

    def test_no_show_fee_is_the_full_price(self):
        self.assertEqual(fees.no_show_fee(8750), 8750)


class FormattingTest(unittest.TestCase):
    def test_money_has_symbol_and_thousands_separator(self):
        self.assertEqual(format_money(123456, "USD"), "$1,234.56")
        self.assertEqual(format_money(1999, "CAD"), "$19.99")

    def test_unknown_currency_uses_its_code(self):
        self.assertEqual(format_money(2550, "MXN"), "MXN 25.50")

    def test_slot_label(self):
        self.assertEqual(format_slot(datetime(2026, 3, 10, 9, 0)), "Tue 10 Mar at 09:00")
