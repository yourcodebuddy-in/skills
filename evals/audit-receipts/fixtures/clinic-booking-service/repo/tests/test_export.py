import csv
import io
from datetime import timedelta

from helpers import ClinicTestCase

from clinicbook import bookings, export, worker
from clinicbook.errors import ValidationError
from clinicbook.timeutil import parse_day


class ExportTest(ClinicTestCase):
    def rows(self, first, last, clinic=None):
        out = io.StringIO()
        export.write_bookings_csv(self.conn, clinic or self.east, parse_day(first), parse_day(last), out)
        return list(csv.DictReader(io.StringIO(out.getvalue())))

    def test_rows_use_clinic_local_date_and_time(self):
        patient = self.add_patient(self.east, "sam@example.com")
        self.book(self.east, self.east_doc, patient, "2026-03-04T16:30")
        [row] = self.rows("2026-03-04", "2026-03-04")
        self.assertEqual((row["date"], row["time"], row["patient"]), ("2026-03-04", "16:30", "Sam Lee"))

    def test_only_the_clinics_own_bookings(self):
        here = self.add_patient(self.east, "sam@example.com")
        there = self.add_patient(self.west, "lou@example.com")
        self.book(self.east, self.east_doc, here, "2026-03-04T10:00")
        self.book(self.west, self.west_doc, there, "2026-03-04T10:00")
        self.assertEqual([r["email"] for r in self.rows("2026-03-01", "2026-03-31")], ["sam@example.com"])

    def test_text_that_looks_like_a_formula_is_neutralised(self):
        patient = self.add_patient(self.east, "sam@example.com", name="=HYPERLINK(\"http://x\")")
        self.book(self.east, self.east_doc, patient, "2026-03-04T10:00")
        [row] = self.rows("2026-03-04", "2026-03-04")
        self.assertTrue(row["patient"].startswith("'="))

    def test_charged_fees_are_included(self):
        patient = self.add_patient(self.east, "sam@example.com")
        booking = self.book(self.east, self.east_doc, patient, "2026-03-03T09:00")
        bookings.mark_no_show(self.conn, booking, self.east, self.now + timedelta(days=1))
        worker.run_fee_jobs(self.conn, self.payments, self.now)
        [row] = self.rows("2026-03-03", "2026-03-03")
        self.assertEqual((row["status"], row["fees_charged_cents"]), ("no_show", "12000"))

    def test_range_limits(self):
        with self.assertRaises(ValidationError):
            self.rows("2026-03-05", "2026-03-04")
        with self.assertRaises(ValidationError):
            self.rows("2026-01-01", "2026-04-30")
