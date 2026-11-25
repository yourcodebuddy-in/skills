"""available_slots looks up taken slots by the UTC date, not the clinic's day, so for a clinic west of
UTC a booked late-afternoon slot (which falls on the next UTC date) is still offered as open."""
import os
import sys

sys.dont_write_bytecode = True
sys.path[:0] = [os.getcwd(), os.path.join(os.getcwd(), "tests")]

from helpers import ClinicTestCase  # noqa: E402

from clinicbook import slots  # noqa: E402
from clinicbook.errors import SlotTaken  # noqa: E402
from clinicbook.timeutil import parse_day  # noqa: E402

case = ClinicTestCase()
case.setUp()
try:
    first = case.add_patient(case.west, "a@example.com")
    second = case.add_patient(case.west, "b@example.com")
    morning = case.book(case.west, case.west_doc, first, "2026-03-04T09:00")
    late = case.book(case.west, case.west_doc, first, "2026-03-04T16:30")
    offered = [s.local_start for s in slots.available_slots(case.conn, case.west, case.west_doc, parse_day("2026-03-04"), case.now)]
    try:
        case.book(case.west, case.west_doc, second, "2026-03-04T16:30")
        outcome = "booked"
    except SlotTaken:
        outcome = "slot_taken"
    print(f"booked {morning.start_utc} and {late.start_utc}; 09:00 offered: {'2026-03-04T09:00' in offered}; "
          f"16:30 offered: {'2026-03-04T16:30' in offered}; booking the offered 16:30 -> {outcome}")
    ok = "2026-03-04T09:00" not in offered and "2026-03-04T16:30" in offered and outcome == "slot_taken"
finally:
    case.doCleanups()
sys.exit(0 if ok else 1)
