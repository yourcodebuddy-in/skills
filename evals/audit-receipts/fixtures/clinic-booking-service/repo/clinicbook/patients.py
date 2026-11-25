"""Patient records. A patient belongs to one clinic; the same person at two clinics is two records."""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from datetime import datetime

from clinicbook.errors import Conflict, NotFound, ValidationError
from clinicbook.formatting import clean_name
from clinicbook.timeutil import to_db
from clinicbook.validation import normalize_email, normalize_phone

DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 200

# Sort keys the API accepts, and the ORDER BY each one stands for.
SORT_COLUMNS = {
    "name": "name COLLATE NOCASE, id",
    "newest": "created_at DESC, id DESC",
    "email": "email, id",
}


@dataclass(frozen=True)
class Patient:
    id: int
    clinic_id: int
    name: str
    email: str
    phone: str | None
    card_ref: str | None


def _from_row(row: sqlite3.Row) -> Patient:
    return Patient(row["id"], row["clinic_id"], row["name"], row["email"], row["phone"], row["card_ref"])


def create_patient(
    conn: sqlite3.Connection,
    clinic_id: int,
    *,
    name: str,
    email: str,
    phone: str | None,
    now: datetime,
    card_ref: str | None = None,
) -> Patient:
    name = clean_name(name)
    if not name:
        raise ValidationError("name is required")
    email = normalize_email(email)
    phone = normalize_phone(phone)
    try:
        cur = conn.execute(
            "INSERT INTO patients (clinic_id, name, email, phone, card_ref, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (clinic_id, name, email, phone, card_ref, to_db(now)),
        )
    except sqlite3.IntegrityError as exc:
        raise Conflict("this clinic already has a patient with that email") from exc
    return get_patient(conn, clinic_id, cur.lastrowid)


def get_patient(conn: sqlite3.Connection, clinic_id: int, patient_id: int) -> Patient:
    row = conn.execute("SELECT * FROM patients WHERE id = ? AND clinic_id = ?", (patient_id, clinic_id)).fetchone()
    if row is None:
        raise NotFound("patient not found")
    return _from_row(row)


def find_by_email(conn: sqlite3.Connection, clinic_id: int, email: str) -> Patient | None:
    row = conn.execute("SELECT * FROM patients WHERE clinic_id = ? AND email = ?", (clinic_id, email)).fetchone()
    return _from_row(row) if row else None


def list_patients(
    conn: sqlite3.Connection,
    clinic_id: int,
    *,
    sort: str = "name",
    search: str | None = None,
    limit: int = DEFAULT_PAGE_SIZE,
) -> list[Patient]:
    order_by = SORT_COLUMNS.get(sort)
    if order_by is None:
        raise ValidationError(f"sort must be one of {', '.join(SORT_COLUMNS)}")
    where = "clinic_id = ?"
    args: list[object] = [clinic_id]
    if search:
        where += " AND (name LIKE ? OR email LIKE ?)"
        args += [f"%{search}%", f"%{search}%"]
    args.append(max(1, min(limit, MAX_PAGE_SIZE)))
    rows = conn.execute(f"SELECT * FROM patients WHERE {where} ORDER BY {order_by} LIMIT ?", args)
    return [_from_row(row) for row in rows]


def set_card(conn: sqlite3.Connection, clinic_id: int, patient_id: int, card_ref: str | None) -> Patient:
    cur = conn.execute(
        "UPDATE patients SET card_ref = ? WHERE id = ? AND clinic_id = ?", (card_ref, patient_id, clinic_id)
    )
    if cur.rowcount != 1:
        raise NotFound("patient not found")
    return get_patient(conn, clinic_id, patient_id)
