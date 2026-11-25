"""format_money doesn't pad the cents, so $12.05 prints as $12.5 and $120.00 as $120.0, and patients'
messages state the wrong amount."""
import os
import sys

sys.dont_write_bytecode = True
sys.path[:0] = [os.getcwd(), os.path.join(os.getcwd(), "tests")]

from helpers import ClinicTestCase  # noqa: E402

from clinicbook import reminders  # noqa: E402
from clinicbook.formatting import format_money  # noqa: E402

samples = {1205: format_money(1205, "USD"), 12000: format_money(12000, "USD"), 4507: format_money(4507, "USD")}
print(f"format_money: {samples}")

case = ClinicTestCase()
case.setUp()
try:
    doc = case.add_practitioner(case.east, "Dr Cho", price_cents=4505)
    patient = case.add_patient(case.east, "sam@example.com")
    case.book(case.east, doc, patient, "2026-03-03T09:00")
    reminders.enqueue_due_reminders(case.conn, case.now)
    body = case.conn.execute("SELECT body FROM outbox").fetchone()[0]
finally:
    case.doCleanups()
print(f"reminder for a $45.05 appointment: {body}")
ok = samples[1205] == "$12.5" and samples[12000] == "$120.0" and "charged $45.5." in body
sys.exit(0 if ok else 1)
