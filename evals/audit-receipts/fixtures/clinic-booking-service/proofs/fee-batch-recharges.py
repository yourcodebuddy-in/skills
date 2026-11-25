"""A provider error part-way through a fee batch leaves the fees already charged as pending,
so the next worker tick charges those cards again."""
import os
import sys
from datetime import timedelta

sys.dont_write_bytecode = True
sys.path[:0] = [os.getcwd(), os.path.join(os.getcwd(), "tests")]

import logging  # noqa: E402

from helpers import ClinicTestCase  # noqa: E402

from clinicbook import bookings, worker  # noqa: E402
from clinicbook.gateways.payments import PaymentUnavailable  # noqa: E402

logging.disable(logging.CRITICAL)


class FlakyPayments:
    """Accepts every charge, except that the first attempt on card_b gets a 503 from the provider."""

    def __init__(self):
        self.charges = []
        self.failed_once = False

    def charge(self, card_ref, amount_cents, currency, description):
        if card_ref == "card_b" and not self.failed_once:
            self.failed_once = True
            raise PaymentUnavailable("payment provider answered 503")
        self.charges.append((card_ref, amount_cents))
        return f"ch_{len(self.charges)}"


case = ClinicTestCase()
case.setUp()
try:
    a = case.add_patient(case.east, "a@example.com", card_ref="card_a")
    b = case.add_patient(case.east, "b@example.com", card_ref="card_b")
    for patient, start in ((a, "2026-03-03T09:00"), (b, "2026-03-03T09:30")):
        booking = case.book(case.east, case.east_doc, patient, start)
        bookings.mark_no_show(case.conn, booking, case.east, case.now + timedelta(days=1))

    payments = FlakyPayments()
    runner = worker.Worker(case.db_path, case.sms, payments, clock=lambda: case.now + timedelta(days=1))
    runner.tick()
    runner.tick()
    card_a_charges = [c for c in payments.charges if c[0] == "card_a"]
    statuses = [r[0] for r in case.conn.execute("SELECT status FROM fee_jobs ORDER BY id")]
    print(f"charges: {payments.charges}; fee job statuses: {statuses}")
    ok = len(card_a_charges) == 2 and statuses == ["charged", "charged"]
finally:
    case.doCleanups()
sys.exit(0 if ok else 1)
