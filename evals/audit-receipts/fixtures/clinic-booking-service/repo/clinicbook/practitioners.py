"""Practitioners and their weekly working hours."""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from datetime import time

from clinicbook.errors import NotFound, ValidationError


@dataclass(frozen=True)
class Practitioner:
    id: int
    clinic_id: int
    name: str
    specialty: str
    slot_minutes: int
    price_cents: int
    active: bool


def _from_row(row: sqlite3.Row) -> Practitioner:
    return Practitioner(
        row["id"],
        row["clinic_id"],
        row["name"],
        row["specialty"],
        row["slot_minutes"],
        row["price_cents"],
        bool(row["active"]),
    )


def create_practitioner(
    conn: sqlite3.Connection,
    clinic_id: int,
    name: str,
    specialty: str,
    slot_minutes: int,
    price_cents: int,
) -> int:
    if not 10 <= slot_minutes <= 120:
        raise ValidationError("slot length must be between 10 and 120 minutes")
    if price_cents < 0:
        raise ValidationError("price can't be negative")
    cur = conn.execute(
        "INSERT INTO practitioners (clinic_id, name, specialty, slot_minutes, price_cents) VALUES (?, ?, ?, ?, ?)",
        (clinic_id, name.strip(), specialty.strip(), slot_minutes, price_cents),
    )
    return cur.lastrowid


def get_practitioner(conn: sqlite3.Connection, clinic_id: int, practitioner_id: int) -> Practitioner:
    row = conn.execute(
        "SELECT * FROM practitioners WHERE id = ? AND clinic_id = ?", (practitioner_id, clinic_id)
    ).fetchone()
    if row is None:
        raise NotFound("practitioner not found")
    return _from_row(row)


def list_practitioners(conn: sqlite3.Connection, clinic_id: int, *, include_inactive: bool = False) -> list[Practitioner]:
    sql = "SELECT * FROM practitioners WHERE clinic_id = ?"
    if not include_inactive:
        sql += " AND active = 1"
    return [_from_row(row) for row in conn.execute(sql + " ORDER BY name", (clinic_id,))]


def _parse_clock(text: str) -> time:
    try:
        parsed = time.fromisoformat(text)
    except ValueError as exc:
        raise ValidationError(f"not a time of day: {text!r} (use HH:MM)") from exc
    if parsed.second or parsed.microsecond:
        raise ValidationError("working hours are whole minutes")
    return parsed


def add_working_hours(conn: sqlite3.Connection, practitioner_id: int, weekday: int, start: str, end: str) -> None:
    """Add a block of hours on a weekday (0 is Monday). A day can have several blocks."""
    if not 0 <= weekday <= 6:
        raise ValidationError("weekday must be 0 (Monday) to 6 (Sunday)")
    opens, closes = _parse_clock(start), _parse_clock(end)
    if opens >= closes:
        raise ValidationError("working hours must end after they start")
    for row in working_hours(conn, practitioner_id, weekday):
        if opens < _parse_clock(row[1]) and _parse_clock(row[0]) < closes:
            raise ValidationError("working hours overlap an existing block")
    conn.execute(
        "INSERT INTO working_hours (practitioner_id, weekday, start_time, end_time) VALUES (?, ?, ?, ?)",
        (practitioner_id, weekday, opens.strftime("%H:%M"), closes.strftime("%H:%M")),
    )


def working_hours(conn: sqlite3.Connection, practitioner_id: int, weekday: int) -> list[tuple[str, str]]:
    rows = conn.execute(
        "SELECT start_time, end_time FROM working_hours WHERE practitioner_id = ? AND weekday = ? ORDER BY start_time",
        (practitioner_id, weekday),
    )
    return [(row["start_time"], row["end_time"]) for row in rows]


def deactivate(conn: sqlite3.Connection, clinic_id: int, practitioner_id: int) -> None:
    cur = conn.execute(
        "UPDATE practitioners SET active = 0 WHERE id = ? AND clinic_id = ?", (practitioner_id, clinic_id)
    )
    if cur.rowcount != 1:
        raise NotFound("practitioner not found")
