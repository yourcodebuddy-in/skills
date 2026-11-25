"""Clinics are the tenants: every patient, practitioner, booking and staff account belongs to one."""

from __future__ import annotations

import re
import sqlite3
from dataclasses import dataclass
from datetime import datetime

from clinicbook.constants import CURRENCY_SYMBOLS
from clinicbook.errors import Conflict, NotFound, ValidationError
from clinicbook.timeutil import to_db, zone

SLUG_PATTERN = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


@dataclass(frozen=True)
class Clinic:
    id: int
    slug: str
    name: str
    timezone: str
    currency: str


def _from_row(row: sqlite3.Row) -> Clinic:
    return Clinic(row["id"], row["slug"], row["name"], row["timezone"], row["currency"])


def create_clinic(conn: sqlite3.Connection, slug: str, name: str, tz: str, currency: str, now: datetime) -> Clinic:
    if not SLUG_PATTERN.match(slug) or len(slug) > 40:
        raise ValidationError("slug must be lowercase letters, digits and dashes")
    try:
        zone(tz)
    except ValueError as exc:
        raise ValidationError(str(exc)) from exc
    if currency not in CURRENCY_SYMBOLS:
        raise ValidationError(f"currency must be one of {', '.join(CURRENCY_SYMBOLS)}")
    if conn.execute("SELECT 1 FROM clinics WHERE slug = ?", (slug,)).fetchone():
        raise Conflict(f"a clinic called {slug} already exists")
    cur = conn.execute(
        "INSERT INTO clinics (slug, name, timezone, currency, created_at) VALUES (?, ?, ?, ?, ?)",
        (slug, name.strip(), tz, currency, to_db(now)),
    )
    return get_clinic(conn, cur.lastrowid)


def get_clinic(conn: sqlite3.Connection, clinic_id: int) -> Clinic:
    row = conn.execute("SELECT * FROM clinics WHERE id = ?", (clinic_id,)).fetchone()
    if row is None:
        raise NotFound("clinic not found")
    return _from_row(row)


def get_clinic_by_slug(conn: sqlite3.Connection, slug: str) -> Clinic:
    row = conn.execute("SELECT * FROM clinics WHERE slug = ?", (slug,)).fetchone()
    if row is None:
        raise NotFound("clinic not found")
    return _from_row(row)
