"""Schema migrations, tracked with SQLite's ``user_version``."""

import logging
import sqlite3

log = logging.getLogger(__name__)

MIGRATIONS: list[tuple[int, str]] = [
    (
        1,
        """
        CREATE TABLE customers (
            id INTEGER PRIMARY KEY,
            account TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            plan TEXT NOT NULL,
            country TEXT NOT NULL,
            vat_id TEXT,
            created_at TEXT NOT NULL
        );
        CREATE TABLE import_batches (
            id INTEGER PRIMARY KEY,
            customer_id INTEGER NOT NULL REFERENCES customers (id),
            file_name TEXT NOT NULL,
            file_sha256 TEXT NOT NULL UNIQUE,
            row_count INTEGER NOT NULL,
            imported_at TEXT NOT NULL
        );
        CREATE TABLE usage_events (
            id INTEGER PRIMARY KEY,
            batch_id INTEGER NOT NULL REFERENCES import_batches (id),
            customer_id INTEGER NOT NULL REFERENCES customers (id),
            metric TEXT NOT NULL,
            quantity TEXT NOT NULL,
            occurred_at TEXT NOT NULL
        );
        CREATE INDEX usage_events_customer_time ON usage_events (customer_id, occurred_at);
        """,
    ),
    (
        2,
        """
        CREATE TABLE invoices (
            id INTEGER PRIMARY KEY,
            customer_id INTEGER NOT NULL REFERENCES customers (id),
            period TEXT NOT NULL,
            number TEXT NOT NULL UNIQUE,
            status TEXT NOT NULL,
            subtotal_cents INTEGER NOT NULL,
            discount_cents INTEGER NOT NULL,
            tax_rate TEXT NOT NULL,
            tax_cents INTEGER NOT NULL,
            total_cents INTEGER NOT NULL,
            issued_on TEXT NOT NULL,
            due_on TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE invoice_lines (
            id INTEGER PRIMARY KEY,
            invoice_id INTEGER NOT NULL REFERENCES invoices (id),
            position INTEGER NOT NULL,
            description TEXT NOT NULL,
            metric TEXT,
            quantity TEXT,
            amount_cents INTEGER NOT NULL
        );
        """,
    ),
    (
        3,
        """
        ALTER TABLE customers ADD COLUMN timezone TEXT NOT NULL DEFAULT 'UTC';
        ALTER TABLE customers ADD COLUMN discount TEXT;
        """,
    ),
    (
        4,
        """
        CREATE TABLE invoices_new (
            id INTEGER PRIMARY KEY,
            customer_id INTEGER NOT NULL REFERENCES customers (id),
            period TEXT NOT NULL,
            number TEXT NOT NULL UNIQUE,
            status TEXT NOT NULL CHECK (status IN ('draft', 'finalized', 'sent')),
            subtotal_cents INTEGER NOT NULL,
            discount_cents INTEGER NOT NULL,
            tax_rate TEXT NOT NULL,
            tax_cents INTEGER NOT NULL,
            total_cents INTEGER NOT NULL,
            issued_on TEXT NOT NULL,
            due_on TEXT NOT NULL,
            created_at TEXT NOT NULL,
            sent_at TEXT,
            UNIQUE (customer_id, period)
        );
        INSERT INTO invoices_new (
            id, customer_id, period, number, status, subtotal_cents, tax_cents,
            discount_cents, tax_rate, total_cents, issued_on, due_on, created_at
        )
        SELECT
            id, customer_id, period, number, status, subtotal_cents, discount_cents,
            tax_cents, tax_rate, total_cents, issued_on, due_on, created_at
        FROM invoices;
        DROP TABLE invoices;
        ALTER TABLE invoices_new RENAME TO invoices;
        CREATE INDEX invoice_lines_invoice ON invoice_lines (invoice_id, position);
        """,
    ),
]

LATEST_VERSION = MIGRATIONS[-1][0]


def current_version(conn: sqlite3.Connection) -> int:
    return conn.execute("PRAGMA user_version").fetchone()[0]


def migrate(conn: sqlite3.Connection, target: int | None = None) -> list[int]:
    """Apply pending migrations up to ``target`` (default: all) and return their versions.

    Foreign keys are switched off while a migration runs because rebuilding a
    table means dropping the original while other tables still point at it.
    """
    goal = LATEST_VERSION if target is None else target
    applied: list[int] = []
    conn.commit()
    conn.execute("PRAGMA foreign_keys = OFF")
    try:
        for version, script in MIGRATIONS:
            if version <= current_version(conn) or version > goal:
                continue
            try:
                conn.executescript(f"BEGIN;\n{script}\nPRAGMA user_version = {version};\nCOMMIT;")
            except sqlite3.Error:
                if conn.in_transaction:
                    conn.rollback()
                raise
            log.info("applied migration %d", version)
            applied.append(version)
        problems = conn.execute("PRAGMA foreign_key_check").fetchall()
        if problems:
            raise sqlite3.IntegrityError(f"foreign key check failed after migrating: {len(problems)} rows")
    finally:
        conn.execute("PRAGMA foreign_keys = ON")
    return applied
