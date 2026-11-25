"""SQLite connections and transactions (see docs/adr/0001)."""

from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager

BUSY_TIMEOUT_MS = 10_000


def connect(path: str) -> sqlite3.Connection:
    """Open a connection in autocommit mode. Writes that belong together use transaction()."""
    conn = sqlite3.connect(path, timeout=BUSY_TIMEOUT_MS / 1000, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute(f"PRAGMA busy_timeout = {BUSY_TIMEOUT_MS}")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


@contextmanager
def transaction(conn: sqlite3.Connection, *, immediate: bool = False) -> Iterator[sqlite3.Connection]:
    """Run a block in one transaction. immediate=True takes the write lock up front, so a
    read-then-write inside the block can't interleave with another writer."""
    conn.execute("BEGIN IMMEDIATE" if immediate else "BEGIN")
    try:
        yield conn
    except BaseException:
        conn.execute("ROLLBACK")
        raise
    conn.execute("COMMIT")
