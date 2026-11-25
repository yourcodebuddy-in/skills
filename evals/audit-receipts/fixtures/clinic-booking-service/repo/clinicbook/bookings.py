"""Booking, cancelling, rescheduling and closing appointments."""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from datetime import date, datetime

from clinicbook import db, fees, outbox, patients, practitioners, reminders, slots
from clinicbook.clinics import Clinic
from clinicbook.constants import BOOKING_HORIZON_DAYS, FREE_CANCEL_HOURS, MAX_UPCOMING_BOOKINGS
from clinicbook.errors import Conflict, LimitReached, NotFound, SlotTaken, ValidationError
from clinicbook.formatting import format_money
from clinicbook.patients import Patient
from clinicbook.practitioners import Practitioner
from clinicbook.timeutil import day_bounds, from_db, to_db


@dataclass(frozen=True)
class Booking:
    id: int
    clinic_id: int
    practitioner_id: int
    patient_id: int
    start_utc: str
    end_utc: str
    status: str
    price_cents: int
    created_at: str
    cancelled_at: str | None


_COLUMNS = (
    "id, clinic_id, practitioner_id, patient_id, start_utc, end_utc, status, price_cents, created_at, cancelled_at"
)


def _from_row(row: sqlite3.Row) -> Booking:
    return Booking(*(row[name] for name in _COLUMNS.split(", ")))


def get_booking(conn: sqlite3.Connection, booking_id: int) -> Booking | None:
    row = conn.execute(f"SELECT {_COLUMNS} FROM bookings WHERE id = ?", (booking_id,)).fetchone()
    return _from_row(row) if row else None


def get_booking_for_clinic(conn: sqlite3.Connection, clinic_id: int, booking_id: int) -> Booking:
    row = conn.execute(
        f"SELECT {_COLUMNS} FROM bookings WHERE id = ? AND clinic_id = ?", (booking_id, clinic_id)
    ).fetchone()
    if row is None:
        raise NotFound("booking not found")
    return _from_row(row)


def _clashes(conn: sqlite3.Connection, practitioner_id: int, start: str, end: str, exclude_id: int = 0) -> bool:
    row = conn.execute(
        "SELECT 1 FROM bookings WHERE practitioner_id = ? AND status = 'booked'"
        " AND start_utc < ? AND end_utc > ? AND id != ? LIMIT 1",
        (practitioner_id, end, start, exclude_id),
    ).fetchone()
    return row is not None


def _check_new_time(
    conn: sqlite3.Connection, clinic: Clinic, practitioner: Practitioner, local_start: datetime, now: datetime
) -> tuple[str, str]:
    if not practitioner.active:
        raise ValidationError("this practitioner isn't taking bookings")
    start, end = slots.slot_bounds(conn, clinic, practitioner, local_start)
    if start <= now:
        raise ValidationError("that time has already passed")
    if not slots.within_horizon(clinic, local_start.date(), now):
        raise ValidationError(f"bookings open {BOOKING_HORIZON_DAYS} days ahead")
    return to_db(start), to_db(end)


def create_booking(
    conn: sqlite3.Connection,
    clinic: Clinic,
    practitioner: Practitioner,
    patient: Patient,
    local_start: datetime,
    now: datetime,
) -> Booking:
    start, end = _check_new_time(conn, clinic, practitioner, local_start, now)
    with db.transaction(conn, immediate=True):
        upcoming = conn.execute(
            "SELECT COUNT(*) FROM bookings WHERE clinic_id = ? AND patient_id = ? AND status = 'booked' AND start_utc > ?",
            (clinic.id, patient.id, to_db(now)),
        ).fetchone()[0]
        if upcoming >= MAX_UPCOMING_BOOKINGS:
            raise LimitReached(f"you can hold at most {MAX_UPCOMING_BOOKINGS} upcoming bookings at this clinic")
        if _clashes(conn, practitioner.id, start, end):
            raise SlotTaken("that time has just been booked")
        try:
            cur = conn.execute(
                "INSERT INTO bookings (clinic_id, practitioner_id, patient_id, start_utc, end_utc, status, price_cents, created_at)"
                " VALUES (?, ?, ?, ?, ?, 'booked', ?, ?)",
                (clinic.id, practitioner.id, patient.id, start, end, practitioner.price_cents, to_db(now)),
            )
        except sqlite3.IntegrityError as exc:
            raise SlotTaken("that time has just been booked") from exc
    return get_booking(conn, cur.lastrowid)


def _require_upcoming(booking: Booking, now: datetime) -> datetime:
    if booking.status != "booked":
        raise Conflict(f"this booking is {booking.status.replace('_', ' ')}")
    start = from_db(booking.start_utc)
    if start <= now:
        raise Conflict("this appointment has already started")
    return start


def cancel_booking(conn: sqlite3.Connection, booking: Booking, clinic: Clinic, now: datetime, *, by_patient: bool) -> Booking:
    """Cancel an upcoming booking. Patients pay the late fee inside the window; the clinic never does."""
    start = _require_upcoming(booking, now)
    patient = patients.get_patient(conn, booking.clinic_id, booking.patient_id)
    practitioner = practitioners.get_practitioner(conn, booking.clinic_id, booking.practitioner_id)
    fee = fees.late_cancel_fee(booking.price_cents, start, now) if by_patient and patient.card_ref else 0
    fee_text = format_money(fee, clinic.currency) if fee else None
    label = reminders.local_time_label(booking.start_utc, clinic.timezone)
    with db.transaction(conn, immediate=True):
        cur = conn.execute(
            "UPDATE bookings SET status = 'cancelled', cancelled_at = ? WHERE id = ? AND status = 'booked'",
            (to_db(now), booking.id),
        )
        if cur.rowcount != 1:
            raise Conflict("this booking has just changed; reload it")
        outbox.enqueue(
            conn,
            clinic_id=booking.clinic_id,
            booking_id=booking.id,
            kind="cancellation",
            recipient=patient.phone,
            body=reminders.cancellation_text(clinic.name, practitioner.name, label, fee_text),
            now=now,
        )
        if fee:
            fees.enqueue_fee(
                conn,
                clinic_id=booking.clinic_id,
                booking_id=booking.id,
                patient_id=patient.id,
                card_ref=patient.card_ref,
                reason="late_cancel",
                amount_cents=fee,
                currency=clinic.currency,
                now=now,
            )
    return get_booking(conn, booking.id)


def reschedule_booking(
    conn: sqlite3.Connection,
    booking: Booking,
    clinic: Clinic,
    practitioner: Practitioner,
    local_start: datetime,
    now: datetime,
    *,
    by_patient: bool,
) -> Booking:
    current_start = _require_upcoming(booking, now)
    if by_patient and not fees.cancellation_is_free(current_start, now):
        raise Conflict(f"appointments within {FREE_CANCEL_HOURS} hours can only be changed by calling the clinic")
    start, end = _check_new_time(conn, clinic, practitioner, local_start, now)
    with db.transaction(conn, immediate=True):
        if _clashes(conn, practitioner.id, start, end, exclude_id=booking.id):
            raise SlotTaken("that time has just been booked")
        try:
            cur = conn.execute(
                "UPDATE bookings SET start_utc = ?, end_utc = ?, reminder_queued = 0 WHERE id = ? AND status = 'booked'",
                (start, end, booking.id),
            )
        except sqlite3.IntegrityError as exc:
            raise SlotTaken("that time has just been booked") from exc
        if cur.rowcount != 1:
            raise Conflict("this booking has just changed; reload it")
    return get_booking(conn, booking.id)


def _close(conn: sqlite3.Connection, booking: Booking, status: str, now: datetime) -> None:
    if booking.status != "booked":
        raise Conflict(f"this booking is {booking.status.replace('_', ' ')}")
    if from_db(booking.end_utc) > now:
        raise Conflict("this appointment hasn't ended yet")
    cur = conn.execute("UPDATE bookings SET status = ? WHERE id = ? AND status = 'booked'", (status, booking.id))
    if cur.rowcount != 1:
        raise Conflict("this booking has just changed; reload it")


def complete_booking(conn: sqlite3.Connection, booking: Booking, now: datetime) -> Booking:
    with db.transaction(conn, immediate=True):
        _close(conn, booking, "completed", now)
    return get_booking(conn, booking.id)


def mark_no_show(conn: sqlite3.Connection, booking: Booking, clinic: Clinic, now: datetime) -> Booking:
    """Record a missed appointment and queue the no-show fee if the patient has a card on file."""
    patient = patients.get_patient(conn, booking.clinic_id, booking.patient_id)
    fee = fees.no_show_fee(booking.price_cents) if patient.card_ref else 0
    with db.transaction(conn, immediate=True):
        _close(conn, booking, "no_show", now)
        if fee:
            fees.enqueue_fee(
                conn,
                clinic_id=booking.clinic_id,
                booking_id=booking.id,
                patient_id=patient.id,
                card_ref=patient.card_ref,
                reason="no_show",
                amount_cents=fee,
                currency=clinic.currency,
                now=now,
            )
    return get_booking(conn, booking.id)


def list_for_day(conn: sqlite3.Connection, clinic: Clinic, day: date) -> list[Booking]:
    start, end = day_bounds(day, clinic.timezone)
    rows = conn.execute(
        f"SELECT {_COLUMNS} FROM bookings WHERE clinic_id = ? AND start_utc >= ? AND start_utc < ?"
        " ORDER BY start_utc, practitioner_id",
        (clinic.id, start, end),
    )
    return [_from_row(row) for row in rows]


def list_upcoming_for_patient(conn: sqlite3.Connection, clinic_id: int, patient_id: int, now: datetime) -> list[Booking]:
    rows = conn.execute(
        f"SELECT {_COLUMNS} FROM bookings WHERE clinic_id = ? AND patient_id = ? AND status = 'booked'"
        " AND start_utc > ? ORDER BY start_utc",
        (clinic_id, patient_id, to_db(now)),
    )
    return [_from_row(row) for row in rows]
