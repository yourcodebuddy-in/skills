"""CSV export of a clinic's bookings, for the clinic's admins."""

from __future__ import annotations

import csv
import sqlite3
from datetime import date
from typing import TextIO

from clinicbook.clinics import Clinic
from clinicbook.constants import EXPORT_MAX_DAYS
from clinicbook.errors import ValidationError
from clinicbook.timeutil import day_bounds, from_db, to_local

COLUMNS = [
    "booking_id",
    "date",
    "time",
    "practitioner",
    "patient",
    "email",
    "phone",
    "status",
    "price_cents",
    "fees_charged_cents",
]

# Spreadsheet apps run a cell starting with one of these as a formula.
FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def _text_cell(value: str) -> str:
    return f"'{value}" if value.startswith(FORMULA_PREFIXES) else value


def write_bookings_csv(conn: sqlite3.Connection, clinic: Clinic, first_day: date, last_day: date, out: TextIO) -> int:
    """Write bookings that start between first_day and last_day (clinic days, inclusive). Returns the row count."""
    if last_day < first_day:
        raise ValidationError("the export range ends before it starts")
    if (last_day - first_day).days + 1 > EXPORT_MAX_DAYS:
        raise ValidationError(f"an export can cover at most {EXPORT_MAX_DAYS} days")
    start, _ = day_bounds(first_day, clinic.timezone)
    _, end = day_bounds(last_day, clinic.timezone)
    rows = conn.execute(
        "SELECT b.id, b.start_utc, b.status, b.price_cents, pr.name AS practitioner, pt.name AS patient,"
        " pt.email, pt.phone,"
        " (SELECT COALESCE(SUM(f.amount_cents), 0) FROM fee_jobs f"
        "  WHERE f.booking_id = b.id AND f.status = 'charged') AS fees_charged"
        " FROM bookings b"
        " JOIN practitioners pr ON pr.id = b.practitioner_id"
        " JOIN patients pt ON pt.id = b.patient_id"
        " WHERE b.clinic_id = ? AND b.start_utc >= ? AND b.start_utc < ?"
        " ORDER BY b.start_utc, b.id",
        (clinic.id, start, end),
    )
    writer = csv.writer(out)
    writer.writerow(COLUMNS)
    count = 0
    for row in rows:
        local = to_local(from_db(row["start_utc"]), clinic.timezone)
        writer.writerow(
            [
                row["id"],
                local.strftime("%Y-%m-%d"),
                local.strftime("%H:%M"),
                _text_cell(row["practitioner"]),
                _text_cell(row["patient"]),
                _text_cell(row["email"]),
                row["phone"] or "",
                row["status"],
                row["price_cents"],
                row["fees_charged"],
            ]
        )
        count += 1
    return count
