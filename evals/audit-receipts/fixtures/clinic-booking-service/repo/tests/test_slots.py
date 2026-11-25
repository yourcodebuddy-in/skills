from helpers import ClinicTestCase

from clinicbook import slots
from clinicbook.errors import ValidationError
from clinicbook.timeutil import parse_day, parse_local


class AvailableSlotsTest(ClinicTestCase):
    def starts(self, clinic, practitioner, day):
        return [s.local_start for s in slots.available_slots(self.conn, clinic, practitioner, parse_day(day), self.now)]

    def test_slots_follow_working_hours_in_the_clinic_zone(self):
        found = slots.available_slots(self.conn, self.east, self.east_doc, parse_day("2026-03-04"), self.now)
        self.assertEqual(len(found), 16)
        self.assertEqual(found[0].local_start, "2026-03-04T09:00")
        self.assertEqual(found[0].start_utc, "2026-03-04T14:00:00Z")
        self.assertEqual(found[-1].local_start, "2026-03-04T16:30")

    def test_west_coast_slots_are_converted_from_pacific_time(self):
        found = slots.available_slots(self.conn, self.west, self.west_doc, parse_day("2026-03-04"), self.now)
        self.assertEqual(found[0].start_utc, "2026-03-04T17:00:00Z")

    def test_daylight_saving_change_moves_the_utc_time(self):
        found = slots.available_slots(self.conn, self.east, self.east_doc, parse_day("2026-03-09"), self.now)
        self.assertEqual(found[0].start_utc, "2026-03-09T13:00:00Z")

    def test_booked_slot_is_not_offered(self):
        patient = self.add_patient(self.east, "sam@example.com")
        self.book(self.east, self.east_doc, patient, "2026-03-04T10:00")
        self.assertNotIn("2026-03-04T10:00", self.starts(self.east, self.east_doc, "2026-03-04"))
        self.assertIn("2026-03-04T10:30", self.starts(self.east, self.east_doc, "2026-03-04"))

    def test_slots_already_started_today_are_hidden(self):
        self.assertEqual(self.starts(self.east, self.east_doc, "2026-03-02")[0], "2026-03-02T10:30")

    def test_weekend_has_no_slots(self):
        self.assertEqual(self.starts(self.east, self.east_doc, "2026-03-07"), [])

    def test_days_beyond_the_horizon_have_no_slots(self):
        self.assertEqual(self.starts(self.east, self.east_doc, "2026-05-04"), [])

    def test_slot_bounds_rejects_a_time_off_the_grid(self):
        with self.assertRaises(ValidationError):
            slots.slot_bounds(self.conn, self.east, self.east_doc, parse_local("2026-03-04T09:10"))
