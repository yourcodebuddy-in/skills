from datetime import timedelta

from helpers import ClinicTestCase

from clinicbook import bookings, outbox, worker


class OutboxDeliveryTest(ClinicTestCase):
    def enqueue(self, recipient, body="Hello"):
        return outbox.enqueue(
            self.conn, clinic_id=self.east.id, booking_id=None, kind="test", recipient=recipient, body=body, now=self.now
        )

    def test_due_messages_are_sent_once(self):
        self.enqueue("+12125550101")
        self.enqueue("+12125550102")
        self.assertEqual(worker.deliver_outbox(self.conn, self.sms, self.now), 2)
        self.assertEqual(worker.deliver_outbox(self.conn, self.sms, self.now), 0)
        self.assertEqual([to for to, _ in self.sms.sent], ["+12125550101", "+12125550102"])

    def test_failed_delivery_is_recorded_and_not_retried(self):
        message_id = self.enqueue("+12125550199")
        self.sms.failing_numbers.add("+12125550199")
        self.assertEqual(worker.deliver_outbox(self.conn, self.sms, self.now), 0)
        row = self.conn.execute("SELECT status, last_error FROM outbox WHERE id = ?", (message_id,)).fetchone()
        self.assertEqual(tuple(row), ("failed", "number rejected"))
        self.sms.failing_numbers.clear()
        self.assertEqual(worker.deliver_outbox(self.conn, self.sms, self.now), 0)
        self.assertEqual(len(outbox.failed(self.conn, self.east.id)), 1)


class FeeJobTest(ClinicTestCase):
    def miss(self, email, card_ref="card_ok"):
        patient = self.add_patient(self.east, email, card_ref=card_ref)
        booking = self.book(self.east, self.east_doc, patient, "2026-03-03T09:00")
        later = self.now + timedelta(days=1)
        bookings.mark_no_show(self.conn, booking, self.east, later)
        return booking

    def test_pending_fee_is_charged_and_a_receipt_queued(self):
        booking = self.miss("sam@example.com")
        self.assertEqual(worker.run_fee_jobs(self.conn, self.payments, self.now), 1)
        self.assertEqual(self.payments.charges, [("card_ok", 12000, "USD")])
        job = self.conn.execute("SELECT status, gateway_ref FROM fee_jobs WHERE booking_id = ?", (booking.id,)).fetchone()
        self.assertEqual(tuple(job), ("charged", "ch_1"))
        receipt = self.conn.execute("SELECT kind FROM outbox WHERE booking_id = ?", (booking.id,)).fetchone()
        self.assertEqual(receipt["kind"], "fee_receipt")

    def test_declined_card_is_marked_and_not_retried(self):
        self.miss("sam@example.com", card_ref="card_expired")
        self.payments.declined_cards.add("card_expired")
        self.assertEqual(worker.run_fee_jobs(self.conn, self.payments, self.now), 0)
        self.assertEqual(self.conn.execute("SELECT status FROM fee_jobs").fetchone()[0], "declined")
        self.assertEqual(worker.run_fee_jobs(self.conn, self.payments, self.now), 0)
        self.assertEqual(self.payments.charges, [])

    def test_charged_fee_is_not_charged_again(self):
        self.miss("sam@example.com")
        worker.run_fee_jobs(self.conn, self.payments, self.now)
        worker.run_fee_jobs(self.conn, self.payments, self.now)
        self.assertEqual(len(self.payments.charges), 1)


class TickTest(ClinicTestCase):
    def test_tick_queues_and_sends_a_due_reminder(self):
        patient = self.add_patient(self.east, "sam@example.com")
        self.book(self.east, self.east_doc, patient, "2026-03-03T09:00")
        runner = worker.Worker(self.db_path, self.sms, self.payments, clock=lambda: self.now)
        counts = runner.tick()
        self.assertEqual(counts, {"reminders": 1, "outbox": 1, "fees": 0})
        self.assertEqual(self.sms.sent[0][0], "+12125550142")
