"""Accounts, passwords and session tokens."""

from __future__ import annotations

import hashlib
import hmac
import secrets
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timedelta

from clinicbook.constants import ROLES
from clinicbook.errors import Conflict, Forbidden, Unauthorized, ValidationError
from clinicbook.timeutil import to_db
from clinicbook.validation import normalize_email

PBKDF2_ITERATIONS = 240_000
SALT_BYTES = 16
TOKEN_BYTES = 32


@dataclass(frozen=True)
class User:
    id: int
    clinic_id: int
    email: str
    role: str
    patient_id: int | None


def hash_password(password: str, *, iterations: int = PBKDF2_ITERATIONS) -> str:
    salt = secrets.token_bytes(SALT_BYTES)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
    return f"pbkdf2_sha256${iterations}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, iterations, salt, expected = stored.split("$")
    except ValueError:
        return False
    if scheme != "pbkdf2_sha256":
        return False
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(iterations))
    return hmac.compare_digest(digest.hex(), expected)


# Checked when the email is unknown, so a miss takes as long as a wrong password.
_UNKNOWN_USER_HASH = hash_password(secrets.token_urlsafe(16))


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_user(
    conn: sqlite3.Connection,
    clinic_id: int,
    email: str,
    password_hash: str,
    role: str,
    now: datetime,
    *,
    patient_id: int | None = None,
) -> int:
    if role not in ROLES:
        raise ValidationError(f"role must be one of {', '.join(ROLES)}")
    if (role == "patient") != (patient_id is not None):
        raise ValidationError("patient accounts, and only they, are linked to a patient record")
    email = normalize_email(email)
    try:
        cur = conn.execute(
            "INSERT INTO users (clinic_id, email, password_hash, role, patient_id, created_at)"
            " VALUES (?, ?, ?, ?, ?, ?)",
            (clinic_id, email, password_hash, role, patient_id, to_db(now)),
        )
    except sqlite3.IntegrityError as exc:
        raise Conflict("an account with that email already exists") from exc
    return cur.lastrowid


def login(conn: sqlite3.Connection, email: object, password: object, now: datetime, session_hours: int) -> str:
    """Check the credentials and return a new session token."""
    try:
        email = normalize_email(email)
    except ValidationError as exc:
        raise Unauthorized("email or password is incorrect") from exc
    if not isinstance(password, str):
        raise Unauthorized("email or password is incorrect")
    row = conn.execute("SELECT id, password_hash FROM users WHERE email = ?", (email,)).fetchone()
    stored = row["password_hash"] if row else _UNKNOWN_USER_HASH
    ok = verify_password(password, stored) and row is not None
    conn.execute(
        "INSERT INTO login_attempts (email, succeeded, attempted_at) VALUES (?, ?, ?)",
        (email, int(ok), to_db(now)),
    )
    if not ok:
        raise Unauthorized("email or password is incorrect")
    token = secrets.token_urlsafe(TOKEN_BYTES)
    conn.execute(
        "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
        (_token_hash(token), row["id"], to_db(now), to_db(now + timedelta(hours=session_hours))),
    )
    return token


def authenticate(conn: sqlite3.Connection, token: str, now: datetime) -> User | None:
    row = conn.execute(
        "SELECT u.id, u.clinic_id, u.email, u.role, u.patient_id FROM sessions s"
        " JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?",
        (_token_hash(token), to_db(now)),
    ).fetchone()
    if row is None:
        return None
    return User(row["id"], row["clinic_id"], row["email"], row["role"], row["patient_id"])


def logout(conn: sqlite3.Connection, token: str) -> None:
    conn.execute("DELETE FROM sessions WHERE token_hash = ?", (_token_hash(token),))


def purge(conn: sqlite3.Connection, now: datetime, retention_days: int) -> tuple[int, int]:
    """Delete expired sessions and sign-in attempts older than the retention period."""
    sessions = conn.execute("DELETE FROM sessions WHERE expires_at <= ?", (to_db(now),)).rowcount
    cutoff = to_db(now - timedelta(days=retention_days))
    attempts = conn.execute("DELETE FROM login_attempts WHERE attempted_at < ?", (cutoff,)).rowcount
    return sessions, attempts


def require_role(user: User | None, *roles: str) -> User:
    if user is None:
        raise Unauthorized("sign in first")
    if user.role not in roles:
        raise Forbidden("your account can't do that")
    return user
