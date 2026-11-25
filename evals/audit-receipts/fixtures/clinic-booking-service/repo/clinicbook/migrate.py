"""Applies the numbered SQL files in clinicbook/migrations, each in its own transaction."""

from __future__ import annotations

import re
import sqlite3
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from clinicbook.timeutil import to_db, utcnow

MIGRATIONS_DIR = Path(__file__).resolve().parent / "migrations"
FILE_NAME = re.compile(r"^(\d{3})_([a-z0-9_]+)\.sql$")


class MigrationError(Exception):
    pass


@dataclass(frozen=True)
class Migration:
    version: int
    name: str
    path: Path


def available() -> list[Migration]:
    found = []
    for path in sorted(MIGRATIONS_DIR.iterdir()):
        match = FILE_NAME.match(path.name)
        if match:
            found.append(Migration(int(match.group(1)), match.group(2), path))
    versions = [m.version for m in found]
    if len(versions) != len(set(versions)):
        raise MigrationError("two migration files share a version number")
    return found


def applied(conn: sqlite3.Connection) -> set[int]:
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations ("
        " version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)"
    )
    return {row[0] for row in conn.execute("SELECT version FROM schema_migrations")}


def migrate(conn: sqlite3.Connection, *, now: datetime | None = None, target: int | None = None) -> list[str]:
    """Apply pending migrations up to target (all by default). Returns the files applied."""
    now = now or utcnow()
    done = applied(conn)
    ran = []
    for migration in available():
        if migration.version in done or (target is not None and migration.version > target):
            continue
        try:
            conn.executescript("BEGIN;\n" + migration.path.read_text())
            conn.execute(
                "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
                (migration.version, migration.name, to_db(now)),
            )
            conn.execute("COMMIT")
        except sqlite3.Error as exc:
            if conn.in_transaction:
                conn.execute("ROLLBACK")
            raise MigrationError(f"{migration.path.name}: {exc}") from exc
        ran.append(migration.path.name)
    return ran
