"""Patient message texts, and queueing of appointment reminders."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timedelta

from clinicbook import db, outbox
from clinicbook.constants import REMINDER_LEAD_HOURS
from clinicbook.fees import REASONS, no_show_fee
from clinicbook.formatting import format_money, format_slot
from clinicbook.timeutil import from_db, to_db, to_local


def local_time_label(start_utc: str, tz: str) -> str:
    return format_slot(to_local(from_db(start_utc), tz))


def reminder_text(clinic_name: str, practitioner_name: str, label: str, fee_text: str | None) -> str:
    text = f"Reminder: your appointment with {practitioner_name} at {clinic_name} is {label}."
    if fee_text:
        text += f" Missed appointments are charged {fee_text}."
    return text + " To change it, call the clinic."


def cancellation_text(clinic_name: str, practitioner_name: str, label: str, fee_text: str | None) -> str:
    text = f"Your appointment with {practitioner_name} at {clinic_name} on {label} is cancelled."
    if fee_text:
        text += f" A late cancellation fee of {fee_text} will be charged to your card."
    return text


def reschedule_text(clinic_name: str, practitioner_name: str, label: str) -> str:
    return f"Your appointment with {practitioner_name} at {clinic_name} has moved to {label}."


def fee_receipt_text(clinic_name: str, reason: str, amount_text: str) -> str:
    return f"{clinic_name}: we charged {amount_text} to your card for a {REASONS[reason]}."


def enqueue_due_reminders(conn: sqlite3.Connection, now: datetime) -> int:
    """Queue one reminder for each booking that starts within the lead time. Returns how many."""
    rows = conn.execute(
        "SELECT b.id, b.clinic_id, b.start_utc, b.price_cents,"
        " c.name AS clinic_name, c.timezone, c.currency,"
        " pr.name AS practitioner_name, pt.phone, pt.card_ref"
        " FROM bookings b"
        " JOIN clinics c ON c.id = b.clinic_id"
        " JOIN practitioners pr ON pr.id = b.practitioner_id"
        " JOIN patients pt ON pt.id = b.patient_id"
        " WHERE b.status = 'booked' AND b.reminder_queued = 0 AND b.start_utc > ? AND b.start_utc <= ?"
        " ORDER BY b.start_utc",
        (to_db(now), to_db(now + timedelta(hours=REMINDER_LEAD_HOURS))),
    ).fetchall()
    queued = 0
    for row in rows:
        fee_text = format_money(no_show_fee(row["price_cents"]), row["currency"]) if row["card_ref"] else None
        label = local_time_label(row["start_utc"], row["timezone"])
        body = reminder_text(row["clinic_name"], row["practitioner_name"], label, fee_text)
        with db.transaction(conn):
            cur = conn.execute(
                "UPDATE bookings SET reminder_queued = 1"
                " WHERE id = ? AND reminder_queued = 0 AND status = 'booked' AND start_utc = ?",
                (row["id"], row["start_utc"]),
            )
            if cur.rowcount == 1 and outbox.enqueue(
                conn,
                clinic_id=row["clinic_id"],
                booking_id=row["id"],
                kind="reminder",
                recipient=row["phone"],
                body=body,
                now=now,
            ):
                queued += 1
    return queued
