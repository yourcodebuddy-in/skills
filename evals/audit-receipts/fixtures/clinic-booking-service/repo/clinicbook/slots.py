"""Bookable slots, generated from a practitioner's working hours in the clinic's time zone."""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

from clinicbook import practitioners
from clinicbook.clinics import Clinic
from clinicbook.constants import BOOKING_HORIZON_DAYS
from clinicbook.errors import ValidationError
from clinicbook.practitioners import Practitioner
from clinicbook.timeutil import LOCAL_FORMAT, local_to_utc, local_today, to_db


@dataclass(frozen=True)
class Slot:
    local_start: str
    start_utc: str
    end_utc: str


def _candidates(
    conn: sqlite3.Connection, clinic: Clinic, practitioner: Practitioner, day: date
) -> list[tuple[datetime, datetime, datetime]]:
    """(local start, UTC start, UTC end) for every slot in the practitioner's hours that day."""
    length = timedelta(minutes=practitioner.slot_minutes)
    found = []
    for opens, closes in practitioners.working_hours(conn, practitioner.id, day.weekday()):
        cursor = datetime.combine(day, time.fromisoformat(opens))
        closing = datetime.combine(day, time.fromisoformat(closes))
        while cursor + length <= closing:
            start = local_to_utc(cursor, clinic.timezone)
            found.append((cursor, start, start + length))
            cursor += length
    return found


def within_horizon(clinic: Clinic, day: date, now: datetime) -> bool:
    today = local_today(now, clinic.timezone)
    return today <= day <= today + timedelta(days=BOOKING_HORIZON_DAYS)


def _taken_starts(conn: sqlite3.Connection, practitioner_id: int, day: date) -> set[str]:
    rows = conn.execute(
        "SELECT start_utc FROM bookings"
        " WHERE practitioner_id = ? AND status = 'booked' AND substr(start_utc, 1, 10) = ?",
        (practitioner_id, day.isoformat()),
    )
    return {row["start_utc"] for row in rows}


def available_slots(
    conn: sqlite3.Connection, clinic: Clinic, practitioner: Practitioner, day: date, now: datetime
) -> list[Slot]:
    """Open slots on a clinic calendar day, in time order. Past slots are left out."""
    if not practitioner.active or not within_horizon(clinic, day, now):
        return []
    taken = _taken_starts(conn, practitioner.id, day)
    slots = []
    for local, start, end in _candidates(conn, clinic, practitioner, day):
        start_text = to_db(start)
        if start > now and start_text not in taken:
            slots.append(Slot(local.strftime(LOCAL_FORMAT), start_text, to_db(end)))
    return slots


def slot_bounds(
    conn: sqlite3.Connection, clinic: Clinic, practitioner: Practitioner, local_start: datetime
) -> tuple[datetime, datetime]:
    """UTC start and end of the slot that begins at local_start, or ValidationError if none does."""
    for local, start, end in _candidates(conn, clinic, practitioner, local_start.date()):
        if local == local_start:
            return start, end
    raise ValidationError("that time isn't one of the practitioner's slots")
