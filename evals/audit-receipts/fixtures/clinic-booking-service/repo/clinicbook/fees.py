"""Late-cancellation and no-show fees. Amounts are integer cents (see docs/adr/0005)."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timedelta

from clinicbook.constants import FREE_CANCEL_HOURS, LATE_CANCEL_PERCENT, NO_SHOW_PERCENT
from clinicbook.timeutil import to_db

REASONS = {"late_cancel": "late cancellation fee", "no_show": "missed appointment fee"}


def percent_of(amount_cents: int, percent: int) -> int:
    """Percentage of an amount, rounded half up to the cent."""
    return (amount_cents * percent + 50) // 100


def cancellation_is_free(start: datetime, now: datetime) -> bool:
    return start - now >= timedelta(hours=FREE_CANCEL_HOURS)


def late_cancel_fee(price_cents: int, start: datetime, now: datetime) -> int:
    if cancellation_is_free(start, now):
        return 0
    return percent_of(price_cents, LATE_CANCEL_PERCENT)


def no_show_fee(price_cents: int) -> int:
    return percent_of(price_cents, NO_SHOW_PERCENT)


def enqueue_fee(
    conn: sqlite3.Connection,
    *,
    clinic_id: int,
    booking_id: int,
    patient_id: int,
    card_ref: str,
    reason: str,
    amount_cents: int,
    currency: str,
    now: datetime,
) -> int:
    """Queue a charge for the worker. Call inside the transaction that changes the booking."""
    if reason not in REASONS:
        raise ValueError(f"unknown fee reason: {reason}")
    cur = conn.execute(
        "INSERT INTO fee_jobs (clinic_id, booking_id, patient_id, card_ref, reason, amount_cents, currency, created_at)"
        " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (clinic_id, booking_id, patient_id, card_ref, reason, amount_cents, currency, to_db(now)),
    )
    return cur.lastrowid
