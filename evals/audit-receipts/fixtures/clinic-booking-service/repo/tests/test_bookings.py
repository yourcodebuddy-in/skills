from datetime import timedelta

from helpers import ClinicTestCase

from clinicbook import bookings, fees
from clinicbook.errors import Conflict, LimitReached, SlotTaken, ValidationError
from clinicbook.timeutil import parse_day, parse_local


class CreateBookingTest(ClinicTestCase):
    def setUp(self):
        super().setUp()
        self.patient = self.add_patient(self.east, "sam@example.com")

    def test_booking_takes_the_slot_time_and_price(self):
        booking = self.book(self.east, self.east_doc, self.patient, "2026-03-04T09:00")
        self.assertEqual(booking.status, "booked")
        self.assertEqual(booking.start_utc, "2026-03-04T14:00:00Z")
        self.assertEqual(booking.end_utc, "2026-03-04T14:30:00Z")
        self.assertEqual(booking.price_cents, 12000)

    def test_same_time_cannot_be_booked_twice(self):
        other = self.add_patient(self.east, "kim@example.com")
        self.book(self.east, self.east_doc, self.patient, "2026-03-04T09:00")
        with self.assertRaises(SlotTaken):
            self.book(self.east, self.east_doc, other, "2026-03-04T09:00")

    def test_time_outside_working_hours_is_refused(self):
        with self.assertRaises(ValidationError):
            self.book(self.east, self.east_doc, self.patient, "2026-03-04T18:00")

    def test_time_off_the_slot_grid_is_refused(self):
        with self.assertRaises(ValidationError):
            self.book(self.east, self.east_doc, self.patient, "2026-03-04T09:15")

    def test_past_time_is_refused(self):
        with self.assertRaises(ValidationError):
            self.book(self.east, self.east_doc, self.patient, "2026-03-02T09:30")

    def test_time_beyond_the_horizon_is_refused(self):
        with self.assertRaises(ValidationError):
            self.book(self.east, self.east_doc, self.patient, "2026-05-04T09:00")

    def test_upcoming_bookings_are_capped(self):
        for start in ("2026-03-04T09:00", "2026-03-04T10:00", "2026-03-05T09:00"):
            self.book(self.east, self.east_doc, self.patient, start)
        with self.assertRaises(LimitReached):
            self.book(self.east, self.east_doc, self.patient, "2026-03-06T09:00")


class CancelBookingTest(ClinicTestCase):
    def setUp(self):
        super().setUp()
        self.patient = self.add_patient(self.east, "sam@example.com")

    def fee_jobs(self):
        return self.conn.execute("SELECT reason, amount_cents, status FROM fee_jobs").fetchall()

    def test_cancelling_more_than_a_day_ahead_is_free(self):
        booking = self.book(self.east, self.east_doc, self.patient, "2026-03-04T09:00")
        cancelled = bookings.cancel_booking(self.conn, booking, self.east, self.now, by_patient=True)
        self.assertEqual(cancelled.status, "cancelled")
        self.assertEqual(self.fee_jobs(), [])

    def test_late_cancellation_by_patient_queues_half_the_price(self):
        booking = self.book(self.east, self.east_doc, self.patient, "2026-03-03T09:00")
        bookings.cancel_booking(self.conn, booking, self.east, self.now, by_patient=True)
        [job] = self.fee_jobs()
        self.assertEqual((job["reason"], job["amount_cents"], job["status"]), ("late_cancel", 6000, "pending"))

    def test_clinic_cancellation_never_charges(self):
        booking = self.book(self.east, self.east_doc, self.patient, "2026-03-03T09:00")
        bookings.cancel_booking(self.conn, booking, self.east, self.now, by_patient=False)
        self.assertEqual(self.fee_jobs(), [])

    def test_patient_without_a_card_is_not_charged(self):
        patient = self.add_patient(self.east, "nocard@example.com", card_ref=None)
        booking = self.book(self.east, self.east_doc, patient, "2026-03-03T09:00")
        bookings.cancel_booking(self.conn, booking, self.east, self.now, by_patient=True)
        self.assertEqual(self.fee_jobs(), [])

    def test_cancellation_message_is_queued(self):
        booking = self.book(self.east, self.east_doc, self.patient, "2026-03-04T09:00")
        bookings.cancel_booking(self.conn, booking, self.east, self.now, by_patient=True)
        row = self.conn.execute("SELECT kind, recipient, status FROM outbox").fetchone()
        self.assertEqual(tuple(row), ("cancellation", "+12125550142", "pending"))

    def test_cancelled_booking_cannot_be_cancelled_again(self):
        booking = self.book(self.east, self.east_doc, self.patient, "2026-03-04T09:00")
        bookings.cancel_booking(self.conn, booking, self.east, self.now, by_patient=True)
        stale = bookings.get_booking(self.conn, booking.id)
        with self.assertRaises(Conflict):
            bookings.cancel_booking(self.conn, stale, self.east, self.now, by_patient=True)


class CloseBookingTest(ClinicTestCase):
    def setUp(self):
        super().setUp()
        self.patient = self.add_patient(self.east, "sam@example.com")
        self.booking = self.book(self.east, self.east_doc, self.patient, "2026-03-03T09:00")

    def test_no_show_queues_the_full_price(self):
        self.now = self.now + timedelta(days=1)
        missed = bookings.mark_no_show(self.conn, self.booking, self.east, self.now)
        self.assertEqual(missed.status, "no_show")
        job = self.conn.execute("SELECT reason, amount_cents FROM fee_jobs").fetchone()
        self.assertEqual(tuple(job), ("no_show", fees.no_show_fee(12000)))

    def test_no_show_before_the_end_is_refused(self):
        with self.assertRaises(Conflict):
            bookings.mark_no_show(self.conn, self.booking, self.east, self.now)

    def test_completed_booking_has_no_fee(self):
        self.now = self.now + timedelta(days=1)
        done = bookings.complete_booking(self.conn, self.booking, self.now)
        self.assertEqual(done.status, "completed")
        self.assertIsNone(self.conn.execute("SELECT 1 FROM fee_jobs").fetchone())


class RescheduleTest(ClinicTestCase):
    def setUp(self):
        super().setUp()
        self.patient = self.add_patient(self.east, "sam@example.com")

    def test_moves_the_booking_and_requeues_the_reminder(self):
        booking = self.book(self.east, self.east_doc, self.patient, "2026-03-04T09:00")
        self.conn.execute("UPDATE bookings SET reminder_queued = 1 WHERE id = ?", (booking.id,))
        moved = bookings.reschedule_booking(
            self.conn, booking, self.east, self.east_doc, parse_local("2026-03-05T11:00"), self.now, by_patient=True
        )
        self.assertEqual(moved.start_utc, "2026-03-05T16:00:00Z")
        queued = self.conn.execute("SELECT reminder_queued FROM bookings WHERE id = ?", (booking.id,)).fetchone()[0]
        self.assertEqual(queued, 0)

    def test_patient_cannot_move_a_booking_inside_the_window(self):
        booking = self.book(self.east, self.east_doc, self.patient, "2026-03-03T09:00")
        with self.assertRaises(Conflict):
            bookings.reschedule_booking(
                self.conn, booking, self.east, self.east_doc, parse_local("2026-03-05T11:00"), self.now, by_patient=True
            )

    def test_clinic_can_move_a_booking_inside_the_window(self):
        booking = self.book(self.east, self.east_doc, self.patient, "2026-03-03T09:00")
        moved = bookings.reschedule_booking(
            self.conn, booking, self.east, self.east_doc, parse_local("2026-03-05T11:00"), self.now, by_patient=False
        )
        self.assertEqual(moved.status, "booked")


class ListTest(ClinicTestCase):
    def test_day_list_uses_the_clinic_calendar_day(self):
        patient = self.add_patient(self.east, "sam@example.com")
        early = self.book(self.east, self.east_doc, patient, "2026-03-04T09:00")
        late = self.book(self.east, self.east_doc, patient, "2026-03-04T16:30")
        self.book(self.east, self.east_doc, patient, "2026-03-05T09:00")
        found = bookings.list_for_day(self.conn, self.east, parse_day("2026-03-04"))
        self.assertEqual([b.id for b in found], [early.id, late.id])
