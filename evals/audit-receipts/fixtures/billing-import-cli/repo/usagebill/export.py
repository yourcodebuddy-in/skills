"""Writing finalized invoices to files for customers and finance."""

import csv
import json
import sqlite3
from datetime import date
from pathlib import Path

from usagebill import repository
from usagebill.formatting import format_cents, format_date, format_period, format_quantity
from usagebill.periods import parse_period


def _invoice_rows(invoice: sqlite3.Row, lines: list) -> list[list[str]]:
    rows = [
        ["Invoice", invoice["number"]],
        ["Customer", invoice["customer_name"]],
        ["Account", invoice["account"]],
        ["Period", format_period(invoice["period"])],
        ["Issued", format_date(date.fromisoformat(invoice["issued_on"]))],
        ["Due", format_date(date.fromisoformat(invoice["due_on"]))],
        [],
        ["Description", "Quantity", "Amount"],
    ]
    for line in lines:
        rows.append([line.description, format_quantity(line.quantity), format_cents(line.amount_cents)])
    rows.append([])
    rows.append(["Subtotal", "", format_cents(invoice["subtotal_cents"])])
    if invoice["discount_cents"]:
        rows.append(["Discount", "", f"-{format_cents(invoice['discount_cents'])}"])
    rows.append([f"Tax ({invoice['tax_rate']}%)", "", format_cents(invoice["tax_cents"])])
    rows.append(["Total", "", format_cents(invoice["total_cents"])])
    return rows


def write_invoice_csv(path: Path, invoice: sqlite3.Row, lines: list) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        csv.writer(handle).writerows(_invoice_rows(invoice, lines))


def export_period(conn: sqlite3.Connection, period: str, out_dir: str | Path) -> list[Path]:
    """Write one CSV per finalized or sent invoice in ``period``, plus a summary.json."""
    parse_period(period)
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    summary = []
    for invoice in repository.invoices_for_period(conn, period):
        lines = repository.invoice_lines(conn, invoice["id"])
        path = out / f"{invoice['number']}.csv"
        write_invoice_csv(path, invoice, lines)
        written.append(path)
        summary.append(
            {
                "number": invoice["number"],
                "account": invoice["account"],
                "status": invoice["status"],
                "total_cents": invoice["total_cents"],
                "file": path.name,
            }
        )
    summary_path = out / "summary.json"
    summary_path.write_text(json.dumps({"period": period, "invoices": summary}, indent=2) + "\n", encoding="utf-8")
    written.append(summary_path)
    return written
