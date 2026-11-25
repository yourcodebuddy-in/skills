import unittest
from datetime import date
from decimal import Decimal

import helpers  # noqa: F401

from usagebill.formatting import format_cents, format_date, format_period, format_quantity
from usagebill.money import AmountError, parse_decimal, percent_of, to_cents


class ParseDecimalTests(unittest.TestCase):
    def test_reads_plain_numbers(self):
        self.assertEqual(parse_decimal("12"), Decimal("12"))
        self.assertEqual(parse_decimal(" 0.375 "), Decimal("0.375"))

    def test_refuses_exponents_and_specials(self):
        for text in ("1e6", "1E6", "NaN", "Infinity", "", "  ", "12,5", "abc"):
            with self.subTest(text=text), self.assertRaises(AmountError):
                parse_decimal(text)


class ToCentsTests(unittest.TestCase):
    def test_rounds_half_up(self):
        self.assertEqual(to_cents(Decimal("616.5")), 617)
        self.assertEqual(to_cents(Decimal("617.5")), 618)
        self.assertEqual(to_cents(Decimal("0.49")), 0)
        self.assertEqual(to_cents(Decimal("0.5")), 1)

    def test_percent_of(self):
        self.assertEqual(percent_of(1999, Decimal("20")), Decimal("399.8"))
        self.assertEqual(to_cents(percent_of(1999, Decimal("20"))), 400)


class FormattingTests(unittest.TestCase):
    def test_format_cents(self):
        self.assertEqual(format_cents(0), "0.00")
        self.assertEqual(format_cents(5), "0.05")
        self.assertEqual(format_cents(2900), "29.00")
        self.assertEqual(format_cents(123456), "1234.56")

    def test_format_quantity(self):
        self.assertEqual(format_quantity(None), "")
        self.assertEqual(format_quantity(Decimal("41250")), "41250")
        self.assertEqual(format_quantity(Decimal("12.50")), "12.5")
        self.assertEqual(format_quantity(Decimal("1E+3")), "1000")

    def test_format_period_and_date(self):
        self.assertEqual(format_period("2026-10"), "October 2026")
        self.assertEqual(format_date(date(2026, 11, 1)), "01 Nov 2026")


if __name__ == "__main__":
    unittest.main()
