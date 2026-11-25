import unittest
from datetime import UTC, datetime

import helpers  # noqa: F401

from usagebill.periods import (
    PeriodError,
    current_period,
    month_bounds,
    next_period,
    parse_period,
    parse_timestamp,
    to_stored,
)


class PeriodTests(unittest.TestCase):
    def test_parse_period(self):
        self.assertEqual(parse_period("2026-10"), (2026, 10))
        for bad in ("2026-13", "2026-1", "26-10", "2026/10", ""):
            with self.subTest(bad=bad), self.assertRaises(PeriodError):
                parse_period(bad)

    def test_next_period_rolls_over_the_year(self):
        self.assertEqual(next_period("2026-11"), "2026-12")
        self.assertEqual(next_period("2026-12"), "2027-01")

    def test_month_bounds_in_utc(self):
        self.assertEqual(month_bounds("2026-10", "UTC"), ("2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z"))

    def test_month_bounds_follow_daylight_saving(self):
        # October starts in BST and ends in GMT.
        self.assertEqual(
            month_bounds("2026-10", "Europe/London"),
            ("2026-09-30T23:00:00Z", "2026-11-01T00:00:00Z"),
        )

    def test_unknown_zone(self):
        with self.assertRaises(PeriodError):
            month_bounds("2026-10", "Mars/Olympus")

    def test_current_period_uses_the_zone(self):
        now = datetime(2026, 10, 31, 23, 30, tzinfo=UTC)
        self.assertEqual(current_period("UTC", now), "2026-10")
        self.assertEqual(current_period("Asia/Tokyo", now), "2026-11")


class TimestampTests(unittest.TestCase):
    def test_reads_z_and_offsets(self):
        self.assertEqual(to_stored(parse_timestamp("2026-10-01T00:00:00Z")), "2026-10-01T00:00:00Z")
        self.assertEqual(to_stored(parse_timestamp("2026-10-01T01:00:00+01:00")), "2026-10-01T00:00:00Z")

    def test_refuses_naive_and_garbage(self):
        for bad in ("2026-10-01T00:00:00", "yesterday", ""):
            with self.subTest(bad=bad), self.assertRaises(PeriodError):
                parse_timestamp(bad)


if __name__ == "__main__":
    unittest.main()
