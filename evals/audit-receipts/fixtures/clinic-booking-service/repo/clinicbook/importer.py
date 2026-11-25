"""Bulk import of patients from a clinic's previous system, as CSV with name, email and phone columns."""

from __future__ import annotations

import csv
import re
import sqlite3
from dataclasses import dataclass, field
from datetime import datetime
from typing import TextIO

from clinicbook import db, patients
from clinicbook.errors import ValidationError
from clinicbook.formatting import clean_name
from clinicbook.timeutil import to_db
from clinicbook.validation import normalize_email

REQUIRED_COLUMNS = {"name", "email"}


@dataclass
class ImportResult:
    created: int = 0
    skipped: int = 0
    errors: list[str] = field(default_factory=list)


def _phone(raw: str | None) -> str | None:
    raw = (raw or "").strip()
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return None
    if raw.startswith("+"):
        return f"+{digits}"
    return f"+1{digits}"


def import_patients(conn: sqlite3.Connection, clinic_id: int, stream: TextIO, now: datetime) -> ImportResult:
    """Create a patient for each row. Rows whose email the clinic already has are skipped."""
    reader = csv.DictReader(stream)
    missing = REQUIRED_COLUMNS - set(reader.fieldnames or [])
    if missing:
        raise ValidationError(f"the file has no {', '.join(sorted(missing))} column")
    result = ImportResult()
    with db.transaction(conn, immediate=True):
        for line, row in enumerate(reader, start=2):
            name = clean_name(row.get("name") or "")
            try:
                email = normalize_email(row.get("email"))
            except ValidationError as exc:
                result.errors.append(f"line {line}: {exc.message}")
                continue
            if not name:
                result.errors.append(f"line {line}: name is empty")
                continue
            if patients.find_by_email(conn, clinic_id, email):
                result.skipped += 1
                continue
            conn.execute(
                "INSERT INTO patients (clinic_id, name, email, phone, created_at) VALUES (?, ?, ?, ?, ?)",
                (clinic_id, name, email, _phone(row.get("phone")), to_db(now)),
            )
            result.created += 1
    return result
