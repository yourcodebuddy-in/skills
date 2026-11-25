"""Migration 004 puts a unique index on (practitioner_id, start_utc) over every booking, cancelled ones
included: it fails on any database where a cancelled slot was booked again, and on a new database it
stops anyone booking a slot that was cancelled."""
import os
import shutil
import sys
import tempfile
from pathlib import Path

sys.dont_write_bytecode = True
sys.path[:0] = [os.getcwd(), os.path.join(os.getcwd(), "tests")]

from helpers import NOW, ClinicTestCase  # noqa: E402

from clinicbook import bookings, clinics, db, migrate, patients, practitioners, slots  # noqa: E402
from clinicbook.errors import SlotTaken  # noqa: E402
from clinicbook.timeutil import parse_day, parse_local  # noqa: E402

# 1. An existing database at migration 003 with an ordinary cancel-and-rebook.
tmp = Path(tempfile.mkdtemp(prefix="proof-migration-"))
try:
    conn = db.connect(str(tmp / "live.sqlite3"))
    migrate.migrate(conn, now=NOW, target=3)
    clinic = clinics.create_clinic(conn, "harbor-east", "Harbor East", "America/New_York", "USD", NOW)
    pid = practitioners.create_practitioner(conn, clinic.id, "Dr Ana Ruiz", "", 30, 12000)
    practitioners.add_working_hours(conn, pid, 2, "09:00", "17:00")
    doc = practitioners.get_practitioner(conn, clinic.id, pid)
    first = patients.create_patient(conn, clinic.id, name="A", email="a@example.com", phone=None, now=NOW)
    second = patients.create_patient(conn, clinic.id, name="B", email="b@example.com", phone=None, now=NOW)
    slot = parse_local("2026-03-04T09:00")
    booking = bookings.create_booking(conn, clinic, doc, first, slot, NOW)
    bookings.cancel_booking(conn, booking, clinic, NOW, by_patient=True)
    bookings.create_booking(conn, clinic, doc, second, slot, NOW)
    try:
        migrate.migrate(conn, now=NOW)
        upgrade_error = None
    except migrate.MigrationError as exc:
        upgrade_error = str(exc)
    still_at = max(migrate.applied(conn))
    conn.close()
finally:
    shutil.rmtree(tmp, ignore_errors=True)
print(f"upgrade of a database with a rebooked slot: {upgrade_error}; schema left at {still_at}")

# 2. A new database: a cancelled slot is offered again but can't be booked.
case = ClinicTestCase()
case.setUp()
try:
    a = case.add_patient(case.east, "a@example.com")
    b = case.add_patient(case.east, "b@example.com")
    booking = case.book(case.east, case.east_doc, a, "2026-03-04T09:00")
    bookings.cancel_booking(case.conn, booking, case.east, case.now, by_patient=True)
    offered = "2026-03-04T09:00" in [
        s.local_start for s in slots.available_slots(case.conn, case.east, case.east_doc, parse_day("2026-03-04"), case.now)
    ]
    try:
        case.book(case.east, case.east_doc, b, "2026-03-04T09:00")
        rebook = "booked"
    except SlotTaken:
        rebook = "refused as slot_taken"
finally:
    case.doCleanups()
print(f"new database: cancelled 09:00 offered again: {offered}; booking it: {rebook}")

ok = upgrade_error is not None and "UNIQUE" in upgrade_error and still_at == 3 and offered and rebook != "booked"
sys.exit(0 if ok else 1)
