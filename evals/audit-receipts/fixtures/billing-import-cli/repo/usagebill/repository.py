"""SQL for customers, usage and invoices.

Functions here don't commit. Callers decide where a transaction starts and ends.
"""

import sqlite3
from collections.abc import Iterable
from decimal import Decimal

from usagebill.models import Customer, Invoice, InvoiceLine, UsageEvent

SORT_COLUMNS = {
    "period": "i.period",
    "account": "c.account",
    "number": "i.number",
    "status": "i.status",
    "total": "i.total_cents",
}


# Customers


def add_customer(
    conn: sqlite3.Connection,
    *,
    account: str,
    name: str,
    plan: str,
    country: str,
    timezone: str,
    vat_id: str | None,
    discount: str | None,
    created_at: str,
) -> int:
    cursor = conn.execute(
        """
        INSERT INTO customers (account, name, plan, country, vat_id, timezone, discount, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (account, name, plan, country.upper(), vat_id, timezone, discount, created_at),
    )
    return cursor.lastrowid


def get_customer(conn: sqlite3.Connection, account: str) -> Customer | None:
    row = conn.execute("SELECT * FROM customers WHERE account = ?", (account,)).fetchone()
    return Customer.from_row(row) if row else None


def list_customers(conn: sqlite3.Connection) -> list[Customer]:
    rows = conn.execute("SELECT * FROM customers ORDER BY account").fetchall()
    return [Customer.from_row(row) for row in rows]


# Imports and usage


def find_batch(conn: sqlite3.Connection, file_sha256: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM import_batches WHERE file_sha256 = ?", (file_sha256,)).fetchone()


def insert_batch(
    conn: sqlite3.Connection,
    *,
    customer_id: int,
    file_name: str,
    file_sha256: str,
    row_count: int,
    imported_at: str,
) -> int:
    cursor = conn.execute(
        """
        INSERT INTO import_batches (customer_id, file_name, file_sha256, row_count, imported_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (customer_id, file_name, file_sha256, row_count, imported_at),
    )
    return cursor.lastrowid


def insert_usage(conn: sqlite3.Connection, batch_id: int, events: Iterable[UsageEvent]) -> None:
    conn.executemany(
        """
        INSERT INTO usage_events (batch_id, customer_id, metric, quantity, occurred_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        [(batch_id, e.customer_id, e.metric, str(e.quantity), e.occurred_at) for e in events],
    )


def usage_totals(conn: sqlite3.Connection, customer_id: int, start: str, end: str) -> dict[str, Decimal]:
    """Sum each metric's usage for one customer between two stored timestamps."""
    rows = conn.execute(
        """
        SELECT metric, quantity FROM usage_events
        WHERE customer_id = ? AND occurred_at >= ? AND occurred_at <= ?
        """,
        (customer_id, start, end),
    ).fetchall()
    totals: dict[str, Decimal] = {}
    for row in rows:
        totals[row["metric"]] = totals.get(row["metric"], Decimal(0)) + Decimal(row["quantity"])
    return totals


# Invoices


def find_invoice(conn: sqlite3.Connection, customer_id: int, period: str) -> sqlite3.Row | None:
    return conn.execute(
        "SELECT * FROM invoices WHERE customer_id = ? AND period = ?",
        (customer_id, period),
    ).fetchone()


def save_draft(conn: sqlite3.Connection, invoice: Invoice, created_at: str) -> int | None:
    """Insert a draft, or overwrite the existing one for the same customer and month.

    Returns the invoice id, or None when that month's invoice is no longer a draft.
    """
    row = conn.execute(
        """
        INSERT INTO invoices (
            customer_id, period, number, status, subtotal_cents, discount_cents,
            tax_rate, tax_cents, total_cents, issued_on, due_on, created_at
        )
        VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (customer_id, period) DO UPDATE SET
            subtotal_cents = excluded.subtotal_cents,
            discount_cents = excluded.discount_cents,
            tax_rate = excluded.tax_rate,
            tax_cents = excluded.tax_cents,
            total_cents = excluded.total_cents,
            issued_on = excluded.issued_on,
            due_on = excluded.due_on
        WHERE invoices.status = 'draft'
        RETURNING id
        """,
        (
            invoice.customer_id,
            invoice.period,
            invoice.number,
            invoice.subtotal_cents,
            invoice.discount_cents,
            str(invoice.tax_rate),
            invoice.tax_cents,
            invoice.total_cents,
            invoice.issued_on.isoformat(),
            invoice.due_on.isoformat(),
            created_at,
        ),
    ).fetchone()
    return row["id"] if row else None


def replace_lines(conn: sqlite3.Connection, invoice_id: int, lines: Iterable[InvoiceLine]) -> None:
    conn.execute("DELETE FROM invoice_lines WHERE invoice_id = ?", (invoice_id,))
    conn.executemany(
        """
        INSERT INTO invoice_lines (invoice_id, position, description, metric, quantity, amount_cents)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        [
            (
                invoice_id,
                position,
                line.description,
                line.metric,
                None if line.quantity is None else str(line.quantity),
                line.amount_cents,
            )
            for position, line in enumerate(lines, start=1)
        ],
    )


def invoice_lines(conn: sqlite3.Connection, invoice_id: int) -> list[InvoiceLine]:
    rows = conn.execute(
        "SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY position",
        (invoice_id,),
    ).fetchall()
    return [
        InvoiceLine(
            description=row["description"],
            amount_cents=row["amount_cents"],
            metric=row["metric"],
            quantity=None if row["quantity"] is None else Decimal(row["quantity"]),
        )
        for row in rows
    ]


def finalize_period(conn: sqlite3.Connection, period: str) -> int:
    cursor = conn.execute(
        "UPDATE invoices SET status = 'finalized' WHERE period = ? AND status = 'draft'",
        (period,),
    )
    return cursor.rowcount


def invoices_by_status(conn: sqlite3.Connection, status: str) -> list[sqlite3.Row]:
    return conn.execute(
        """
        SELECT i.*, c.account, c.name AS customer_name, c.country, c.vat_id
        FROM invoices i JOIN customers c ON c.id = i.customer_id
        WHERE i.status = ?
        ORDER BY i.id
        """,
        (status,),
    ).fetchall()


def invoices_for_period(conn: sqlite3.Connection, period: str) -> list[sqlite3.Row]:
    return conn.execute(
        """
        SELECT i.*, c.account, c.name AS customer_name, c.country, c.vat_id
        FROM invoices i JOIN customers c ON c.id = i.customer_id
        WHERE i.period = ? AND i.status IN ('finalized', 'sent')
        ORDER BY i.number
        """,
        (period,),
    ).fetchall()


def mark_sent(conn: sqlite3.Connection, invoice_id: int, sent_at: str) -> None:
    conn.execute(
        "UPDATE invoices SET status = 'sent', sent_at = ? WHERE id = ? AND status = 'finalized'",
        (sent_at, invoice_id),
    )


def list_invoices(
    conn: sqlite3.Connection,
    *,
    status: str | None = None,
    sort: str = "period",
    descending: bool = False,
) -> list[sqlite3.Row]:
    column = SORT_COLUMNS.get(sort)
    if column is None:
        raise ValueError(f"can't sort by {sort!r}; choose from {', '.join(SORT_COLUMNS)}")
    direction = "DESC" if descending else "ASC"
    sql = """
        SELECT i.id, i.number, i.period, i.status, i.total_cents, c.account
        FROM invoices i JOIN customers c ON c.id = i.customer_id
    """
    params: list[str] = []
    if status is not None:
        sql += " WHERE i.status = ?"
        params.append(status)
    sql += f" ORDER BY {column} {direction}, i.id"
    return conn.execute(sql, params).fetchall()
