import unittest
from datetime import date, datetime, timezone

from clinicbook import timeutil


class TimeTest(unittest.TestCase):
    def test_stored_format_round_trips(self):
        moment = datetime(2026, 3, 4, 14, 0, tzinfo=timezone.utc)
        self.assertEqual(timeutil.to_db(moment), "2026-03-04T14:00:00Z")
        self.assertEqual(timeutil.from_db("2026-03-04T14:00:00Z"), moment)

    def test_naive_datetimes_are_refused(self):
        with self.assertRaises(ValueError):
            timeutil.to_db(datetime(2026, 3, 4, 14, 0))

    def test_local_wall_clock_to_utc(self):
        utc = timeutil.local_to_utc(datetime(2026, 7, 1, 9, 0), "America/Los_Angeles")
        self.assertEqual(timeutil.to_db(utc), "2026-07-01T16:00:00Z")

    def test_day_bounds_follow_daylight_saving(self):
        self.assertEqual(
            timeutil.day_bounds(date(2026, 3, 8), "America/New_York"),
            ("2026-03-08T05:00:00Z", "2026-03-09T04:00:00Z"),
        )

    def test_parse_errors_are_value_errors(self):
        for bad in ("2026-13-01", "", None):
            with self.assertRaises(ValueError):
                timeutil.parse_day(bad)
        with self.assertRaises(ValueError):
            timeutil.parse_local("2026-03-04 09:00")

    def test_unknown_zone(self):
        with self.assertRaises(ValueError):
            timeutil.zone("Mars/Olympus")
