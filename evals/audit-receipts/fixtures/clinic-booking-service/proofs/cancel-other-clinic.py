"""Staff at one clinic can cancel another clinic's booking through POST /api/bookings/{id}/cancel."""
import os
import sys

sys.dont_write_bytecode = True
sys.path[:0] = [os.getcwd(), os.path.join(os.getcwd(), "tests")]

from helpers import ClinicTestCase  # noqa: E402

case = ClinicTestCase()
case.setUp()
try:
    victim = case.add_patient(case.east, "sam@example.com")
    booking = case.book(case.east, case.east_doc, victim, "2026-03-04T09:00")
    outsider = case.add_user(case.west, "desk@bayview.example", "staff")

    read_status, _ = case.call("GET", f"/api/bookings/{booking.id}", token=outsider)
    status, body = case.call("POST", f"/api/bookings/{booking.id}/cancel", token=outsider)
    stored = case.conn.execute("SELECT status FROM bookings WHERE id = ?", (booking.id,)).fetchone()[0]
    message = case.conn.execute("SELECT recipient FROM outbox WHERE booking_id = ?", (booking.id,)).fetchone()
    print(f"west staff GET east booking -> {read_status}; cancel -> {status}; stored status {stored}; sms queued to {message and message[0]}")
    ok = read_status == 404 and status == 200 and stored == "cancelled" and message is not None
finally:
    case.doCleanups()
sys.exit(0 if ok else 1)
