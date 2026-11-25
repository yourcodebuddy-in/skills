from datetime import timedelta
from unittest import mock

from helpers import ClinicTestCase

from clinicbook import reminders


class ReminderTest(ClinicTestCase):
    def setUp(self):
        super().setUp()
        self.patient = self.add_patient(self.east, "sam@example.com")

    def outbox(self):
        return self.conn.execute("SELECT kind, recipient, body FROM outbox ORDER BY id").fetchall()

    def test_booking_within_the_lead_time_gets_a_reminder(self):
        booking = self.book(self.east, self.east_doc, self.patient, "2026-03-03T09:00")
        self.assertEqual(reminders.enqueue_due_reminders(self.conn, self.now), 1)
        [row] = self.outbox()
        self.assertEqual((row["kind"], row["recipient"]), ("reminder", "+12125550142"))
        flag = self.conn.execute("SELECT reminder_queued FROM bookings WHERE id = ?", (booking.id,)).fetchone()[0]
        self.assertEqual(flag, 1)

    def test_reminder_is_queued_once(self):
        self.book(self.east, self.east_doc, self.patient, "2026-03-03T09:00")
        reminders.enqueue_due_reminders(self.conn, self.now)
        self.assertEqual(reminders.enqueue_due_reminders(self.conn, self.now + timedelta(minutes=1)), 0)
        self.assertEqual(len(self.outbox()), 1)

    def test_booking_further_out_waits(self):
        self.book(self.east, self.east_doc, self.patient, "2026-03-04T09:00")
        self.assertEqual(reminders.enqueue_due_reminders(self.conn, self.now), 0)

    def test_cancelled_booking_gets_no_reminder(self):
        from clinicbook import bookings

        booking = self.book(self.east, self.east_doc, self.patient, "2026-03-03T09:00")
        bookings.cancel_booking(self.conn, booking, self.east, self.now, by_patient=False)
        self.assertEqual(reminders.enqueue_due_reminders(self.conn, self.now), 0)

    def test_patient_without_a_phone_gets_nothing(self):
        patient = self.add_patient(self.east, "nophone@example.com", phone=None)
        self.book(self.east, self.east_doc, patient, "2026-03-03T09:00")
        self.assertEqual(reminders.enqueue_due_reminders(self.conn, self.now), 0)
        self.assertEqual(self.outbox(), [])

    def test_reminder_names_the_appointment_time(self):
        self.book(self.east, self.east_doc, self.patient, "2026-03-03T09:00")
        with mock.patch("clinicbook.reminders.local_time_label", return_value="Tue 03 Mar at 09:00"):
            reminders.enqueue_due_reminders(self.conn, self.now)
        self.assertIn("Tue 03 Mar at 09:00", self.outbox()[0]["body"])

    def test_reminder_warns_about_the_no_show_fee_when_a_card_is_on_file(self):
        self.book(self.east, self.east_doc, self.patient, "2026-03-03T09:00")
        reminders.enqueue_due_reminders(self.conn, self.now)
        self.assertIn("Missed appointments are charged", self.outbox()[0]["body"])

    def test_reminder_has_no_fee_warning_without_a_card(self):
        patient = self.add_patient(self.east, "nocard@example.com", card_ref=None)
        self.book(self.east, self.east_doc, patient, "2026-03-03T09:00")
        reminders.enqueue_due_reminders(self.conn, self.now)
        self.assertNotIn("charged", self.outbox()[0]["body"])
