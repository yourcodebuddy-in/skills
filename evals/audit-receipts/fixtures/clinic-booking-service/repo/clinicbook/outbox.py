"""Patient messages waiting to be sent by the worker (see docs/adr/0004 and 0006)."""

from __future__ import annotations

import sqlite3
from datetime import datetime

from clinicbook.timeutil import to_db

MAX_ERROR_LENGTH = 500


def enqueue(
    conn: sqlite3.Connection,
    *,
    clinic_id: int,
    booking_id: int | None,
    kind: str,
    recipient: str | None,
    body: str,
    now: datetime,
) -> int | None:
    """Queue a message, due now. Patients without a phone number get nothing, and None is returned."""
    if not recipient:
        return None
    cur = conn.execute(
        "INSERT INTO outbox (clinic_id, booking_id, kind, recipient, body, due_at, created_at)"
        " VALUES (?, ?, ?, ?, ?, ?, ?)",
        (clinic_id, booking_id, kind, recipient, body, to_db(now), to_db(now)),
    )
    return cur.lastrowid


def claim_due(conn: sqlite3.Connection, now: datetime, limit: int) -> list[sqlite3.Row]:
    """Mark due messages as sent and return them, before anything is handed to the gateway.

    Each row is claimed by its own conditional update, so two workers never both get the same
    row, and a crash after this point loses the message rather than sending it twice.
    """
    rows = conn.execute(
        "SELECT id, clinic_id, recipient, body FROM outbox"
        " WHERE status = 'pending' AND due_at <= ? ORDER BY due_at, id LIMIT ?",
        (to_db(now), limit),
    ).fetchall()
    claimed = []
    for row in rows:
        cur = conn.execute(
            "UPDATE outbox SET status = 'sent', sent_at = ?, attempts = attempts + 1"
            " WHERE id = ? AND status = 'pending'",
            (to_db(now), row["id"]),
        )
        if cur.rowcount == 1:
            claimed.append(row)
    return claimed


def mark_failed(conn: sqlite3.Connection, outbox_id: int, error: str) -> None:
    conn.execute(
        "UPDATE outbox SET status = 'failed', last_error = ? WHERE id = ?",
        (error[:MAX_ERROR_LENGTH], outbox_id),
    )


def failed(conn: sqlite3.Connection, clinic_id: int | None = None, limit: int = 100) -> list[sqlite3.Row]:
    sql = "SELECT id, clinic_id, booking_id, kind, recipient, last_error, sent_at FROM outbox WHERE status = 'failed'"
    args: list[object] = []
    if clinic_id is not None:
        sql += " AND clinic_id = ?"
        args.append(clinic_id)
    args.append(limit)
    return conn.execute(sql + " ORDER BY id DESC LIMIT ?", args).fetchall()
