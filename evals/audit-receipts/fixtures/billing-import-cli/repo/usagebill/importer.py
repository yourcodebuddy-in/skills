"""Usage file import.

A usage file is a CSV with the columns in ``constants.REQUIRED_COLUMNS``. The
whole file is checked before anything is written, and a file with any bad
row is refused as a whole (see docs/adr/0002-whole-file-imports.md).
"""

import csv
import hashlib
import logging
import sqlite3
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from usagebill import constants, repository
from usagebill.models import Customer, UsageEvent
from usagebill.money import AmountError, parse_decimal
from usagebill.periods import PeriodError, parse_timestamp, to_stored
from usagebill.pricing import Plan

log = logging.getLogger(__name__)


class ImportRejected(Exception):
    """Raised when a file can't be imported. ``errors`` lists the reasons."""

    def __init__(self, errors: list[str]):
        super().__init__("; ".join(errors))
        self.errors = errors


@dataclass(frozen=True)
class ImportResult:
    batch_id: int | None
    rows: int
    file_sha256: str
    dry_run: bool


def file_digest(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_rows(path: Path) -> list[tuple[int, dict[str, str]]]:
    """Return each non-blank row with the line it started on."""
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        header = [name.strip() for name in (reader.fieldnames or [])]
        missing = [name for name in constants.REQUIRED_COLUMNS if name not in header]
        if missing:
            raise ImportRejected([f"missing columns: {', '.join(missing)}"])
        reader.fieldnames = header
        rows = []
        for row in reader:
            if any((value or "").strip() for value in row.values() if isinstance(value, str)):
                rows.append((reader.line_num, row))
        return rows


class _RowChecker:
    """Checks rows one at a time and remembers customers it has already looked up."""

    def __init__(self, conn: sqlite3.Connection, plans: dict[str, Plan], now: datetime):
        self.conn = conn
        self.plans = plans
        self.now = now
        self.customers: dict[str, Customer | None] = {}

    def customer(self, account: str) -> Customer | None:
        if account not in self.customers:
            self.customers[account] = repository.get_customer(self.conn, account)
        return self.customers[account]

    def check(self, line_no: int, row: dict[str, str]) -> UsageEvent | str:
        account = (row.get("account") or "").strip()
        customer = self.customer(account)
        if customer is None:
            return f"line {line_no}: unknown account {account!r}"
        plan = self.plans.get(customer.plan)
        if plan is None:
            return f"line {line_no}: account {account} is on unknown plan {customer.plan!r}"
        metric = (row.get("metric") or "").strip()
        if metric not in plan.metrics:
            return f"line {line_no}: metric {metric!r} isn't billed on the {plan.code} plan"
        try:
            quantity = parse_decimal(row.get("quantity") or "")
        except AmountError as exc:
            return f"line {line_no}: {exc}"
        if quantity < 0:
            return f"line {line_no}: quantity can't be negative"
        try:
            occurred = parse_timestamp(row.get("occurred_at") or "")
        except PeriodError as exc:
            return f"line {line_no}: {exc}"
        if occurred > self.now:
            return f"line {line_no}: occurred_at is in the future"
        return UsageEvent(customer.id, metric, quantity, to_stored(occurred))


def import_file(
    conn: sqlite3.Connection,
    path: Path,
    account: str,
    plans: dict[str, Plan],
    *,
    dry_run: bool = False,
    now: datetime | None = None,
) -> ImportResult:
    """Check and store one customer's usage file."""
    moment = now or datetime.now(UTC)
    owner = repository.get_customer(conn, account)
    if owner is None:
        raise ImportRejected([f"unknown account {account!r}"])

    try:
        digest = file_digest(path)
    except OSError as exc:
        raise ImportRejected([f"can't read {path}: {exc.strerror or exc}"]) from exc
    previous = repository.find_batch(conn, digest)
    if previous is not None:
        raise ImportRejected([f"{path.name} was already imported as batch {previous['id']}"])

    try:
        rows = read_rows(path)
    except (UnicodeDecodeError, csv.Error) as exc:
        raise ImportRejected([f"{path.name} isn't a readable UTF-8 CSV file: {exc}"]) from exc
    if not rows:
        raise ImportRejected([f"{path.name} has no usage rows"])

    checker = _RowChecker(conn, plans, moment)
    events: list[UsageEvent] = []
    errors: list[str] = []
    for line_no, row in rows:
        result = checker.check(line_no, row)
        if isinstance(result, str):
            errors.append(result)
        else:
            events.append(result)
    if errors:
        shown = errors[: constants.MAX_ERRORS_REPORTED]
        if len(errors) > len(shown):
            shown.append(f"and {len(errors) - len(shown)} more")
        raise ImportRejected(shown)

    if dry_run:
        log.info("dry run: %s has %d valid rows", path.name, len(events))
        return ImportResult(None, len(events), digest, dry_run=True)

    with conn:
        batch_id = repository.insert_batch(
            conn,
            customer_id=owner.id,
            file_name=path.name,
            file_sha256=digest,
            row_count=len(events),
            imported_at=to_stored(moment),
        )
        repository.insert_usage(conn, batch_id, events)
    log.info("imported %s for %s: %d rows (batch %d)", path.name, account, len(events), batch_id)
    return ImportResult(batch_id, len(events), digest, dry_run=False)
