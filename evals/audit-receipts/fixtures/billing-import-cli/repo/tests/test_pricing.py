import unittest
from decimal import Decimal

import helpers

from usagebill.discounts import DiscountError, DiscountRule, discount_cents, parse_rule
from usagebill.pricing import PlanError, line_amount_cents, load_plans, parse_plans, price_usage
from usagebill.tax import UnknownCountry, tax_cents, tax_rate


class PlanTests(unittest.TestCase):
    def test_bundled_plans_file_loads(self):
        plans = load_plans(helpers.ROOT / "config" / "plans.json")
        self.assertEqual(set(plans), {"starter", "growth", "enterprise"})
        self.assertEqual(plans["starter"].metrics["api_calls"].unit_cents, Decimal("0.05"))

    def test_missing_field_is_an_error(self):
        with self.assertRaises(PlanError):
            parse_plans({"x": {"name": "X", "metrics": {}}})

    def test_negative_price_is_an_error(self):
        data = {"x": {"currency": "GBP", "base_cents": 0, "metrics": {"m": {"unit_cents": "-1"}}}}
        with self.assertRaises(PlanError):
            parse_plans(data)


class PriceUsageTests(unittest.TestCase):
    def setUp(self):
        self.plans = helpers.plans()

    def test_allowance_is_free(self):
        price = self.plans["starter"].metrics["api_calls"]
        self.assertEqual(line_amount_cents(Decimal("9000"), price), 0)
        self.assertEqual(line_amount_cents(Decimal("10000"), price), 0)
        self.assertEqual(line_amount_cents(Decimal("30000"), price), 1000)

    def test_line_rounds_half_up(self):
        price = self.plans["starter"].metrics["api_calls"]
        # 12,350 billable calls at 0.05 cents = 617.5 cents
        self.assertEqual(line_amount_cents(Decimal("22350"), price), 618)

    def test_price_usage_lines(self):
        lines = price_usage(self.plans["starter"], {"storage_gb": Decimal("100"), "api_calls": Decimal("30000")})
        self.assertEqual([line.description for line in lines], ["Starter plan", "API calls", "Storage (GB-days)"])
        self.assertEqual([line.amount_cents for line in lines], [2900, 1000, 150])

    def test_unpriced_metric(self):
        with self.assertRaises(PlanError):
            price_usage(self.plans["starter"], {"seats": Decimal("3")})


class DiscountTests(unittest.TestCase):
    def test_parse_rules(self):
        self.assertEqual(parse_rule("percent:10"), DiscountRule("percent", Decimal("10")))
        self.assertEqual(parse_rule("percent:12.5:5000"), DiscountRule("percent", Decimal("12.5"), 5000))
        self.assertEqual(parse_rule("fixed:1500"), DiscountRule("fixed", Decimal("1500")))

    def test_bad_rules(self):
        for text in ("percent", "percent:0", "percent:101", "percent:10:0", "fixed:-5", "fixed:1.5", "bogus:1", ""):
            with self.subTest(text=text), self.assertRaises(DiscountError):
                parse_rule(text)

    def test_percent_discount(self):
        self.assertEqual(discount_cents(12345, parse_rule("percent:10")), 1235)

    def test_percent_discount_respects_cap(self):
        amount = discount_cents(200_000, parse_rule("percent:10:5000"))
        self.assertTrue(amount, 5000)

    def test_fixed_discount_never_exceeds_subtotal(self):
        self.assertEqual(discount_cents(900, parse_rule("fixed:1500")), 900)
        self.assertEqual(discount_cents(9000, parse_rule("fixed:1500")), 1500)

    def test_no_discount_on_empty_subtotal(self):
        self.assertEqual(discount_cents(0, parse_rule("percent:50")), 0)


class TaxTests(unittest.TestCase):
    def test_rates(self):
        self.assertEqual(tax_rate("GB", None), Decimal("20"))
        self.assertEqual(tax_rate("gb", "GB123"), Decimal("20"))
        self.assertEqual(tax_rate("DE", None), Decimal("19"))
        self.assertEqual(tax_rate("US", None), Decimal("0"))

    def test_eu_reverse_charge(self):
        self.assertEqual(tax_rate("DE", "DE123456789"), Decimal("0"))
        self.assertEqual(tax_rate("IE", "IE1234567T"), Decimal("0"))

    def test_unknown_country(self):
        with self.assertRaises(UnknownCountry):
            tax_rate("ZZ", None)

    def test_tax_rounding(self):
        self.assertEqual(tax_cents(1999, Decimal("20")), 400)
        self.assertEqual(tax_cents(1234, Decimal("23")), 284)
        self.assertEqual(tax_cents(0, Decimal("20")), 0)


if __name__ == "__main__":
    unittest.main()
