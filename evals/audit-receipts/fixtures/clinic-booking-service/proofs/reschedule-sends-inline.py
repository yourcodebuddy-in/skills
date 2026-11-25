"""ADR 0004 says request handlers never call the SMS provider; messages go through the outbox. The
reschedule handler sends its text inline, so a provider failure turns a completed reschedule into a 500
and the message is lost."""
import logging
import os
import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path[:0] = [os.getcwd(), os.path.join(os.getcwd(), "tests")]

from helpers import ClinicTestCase  # noqa: E402

logging.disable(logging.CRITICAL)

adr = Path("docs/adr/0004-patient-messages-through-the-outbox.md").read_text()
if "Request handlers never call the SMS provider" not in adr:
    print("decision not found")
    sys.exit(1)

case = ClinicTestCase()
case.setUp()
try:
    patient = case.add_patient(case.east, "sam@example.com")
    token = case.add_user(case.east, "sam@example.com", "patient", patient=patient)
    booking = case.book(case.east, case.east_doc, patient, "2026-03-04T09:00")

    case.sms.failing_numbers.add(patient.phone)
    status, body = case.call(
        "POST", f"/api/bookings/{booking.id}/reschedule", token=token, body={"start": "2026-03-05T10:00"}
    )
    stored = case.conn.execute("SELECT start_utc FROM bookings WHERE id = ?", (booking.id,)).fetchone()[0]
    queued = case.conn.execute("SELECT COUNT(*) FROM outbox").fetchone()[0]
finally:
    case.doCleanups()
print(f"reschedule with the provider down -> {status} {body}; booking now starts {stored}; outbox rows {queued}")
sys.exit(0 if status == 500 and stored == "2026-03-05T15:00:00Z" and queued == 0 else 1)
