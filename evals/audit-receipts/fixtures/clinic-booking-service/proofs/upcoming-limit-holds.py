"""The README's three-upcoming-bookings limit is enforced: for patients and staff, and when requests
arrive at the same time, since the count and the insert share one BEGIN IMMEDIATE transaction."""
import os
import sys
import threading
from pathlib import Path

sys.dont_write_bytecode = True
sys.path[:0] = [os.getcwd(), os.path.join(os.getcwd(), "tests")]

from helpers import ClinicTestCase  # noqa: E402

from clinicbook import bookings, clinics, db, patients, practitioners  # noqa: E402
from clinicbook.errors import LimitReached  # noqa: E402
from clinicbook.timeutil import parse_local  # noqa: E402

claim = "A patient can hold at most three upcoming bookings at a clinic. A fourth is refused with `409 limit_reached`"
if claim not in Path("README.md").read_text():
    print("claim not found")
    sys.exit(1)

case = ClinicTestCase()
case.setUp()
results = {}
try:
    patient = case.add_patient(case.east, "sam@example.com")
    token = case.add_user(case.east, "sam@example.com", "patient", patient=patient)
    staff = case.add_user(case.east, "desk@harbor.example", "staff")

    def book(start, as_token):
        body = {"practitioner_id": case.east_doc.id, "start": start, "patient_id": patient.id}
        return case.call("POST", "/api/bookings", token=as_token, body=body)

    made = [book(s, token) for s in ("2026-03-04T09:00", "2026-03-04T09:30", "2026-03-04T10:00")]
    fourth = book("2026-03-04T10:30", token)
    by_staff = book("2026-03-04T11:00", staff)
    results["sequential"] = ([m[0] for m in made], fourth[0], fourth[1]["error"]["code"], by_staff[0])

    case.call("POST", f"/api/bookings/{made[0][1]['booking']['id']}/cancel", token=token)
    results["after cancel"] = book("2026-03-04T11:30", token)[0]

    # Concurrent: a second patient, eight threads, each with its own connection, all at once.
    other = case.add_patient(case.east, "kim@example.com")
    barrier = threading.Barrier(8)
    outcomes = []

    def attempt(start):
        conn = db.connect(case.db_path)
        try:
            clinic = clinics.get_clinic(conn, case.east.id)
            doc = practitioners.get_practitioner(conn, clinic.id, case.east_doc.id)
            who = patients.get_patient(conn, clinic.id, other.id)
            barrier.wait()
            bookings.create_booking(conn, clinic, doc, who, parse_local(start), case.now)
            outcomes.append("booked")
        except LimitReached:
            outcomes.append("limit")
        finally:
            conn.close()

    starts = [f"2026-03-05T{h:02d}:{m:02d}" for h in (9, 10, 11, 12) for m in (0, 30)]
    threads = [threading.Thread(target=attempt, args=(s,)) for s in starts]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    results["concurrent"] = sorted(outcomes)
    held = case.conn.execute(
        "SELECT COUNT(*) FROM bookings WHERE patient_id = ? AND status = 'booked'", (other.id,)
    ).fetchone()[0]
finally:
    case.doCleanups()
print(results, "held:", held)
ok = (
    results["sequential"] == ([201, 201, 201], 409, "limit_reached", 409)
    and results["after cancel"] == 201
    and results["concurrent"] == ["booked"] * 3 + ["limit"] * 5
    and held == 3
)
sys.exit(0 if ok else 1)
