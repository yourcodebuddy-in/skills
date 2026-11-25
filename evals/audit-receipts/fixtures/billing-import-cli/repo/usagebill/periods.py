"""Billing periods and timestamps.

A billing period is a calendar month written ``YYYY-MM``. Its edges are
midnight on the first of the month in the customer's own time zone,
converted to UTC so they can be compared with stored usage timestamps.
"""

import re
from datetime import UTC, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

PERIOD_RE = re.compile(r"^(\d{4})-(0[1-9]|1[0-2])$")
STORED_FORMAT = "%Y-%m-%dT%H:%M:%SZ"


class PeriodError(ValueError):
    """Raised for a malformed period, time zone or timestamp."""


def parse_period(period: str) -> tuple[int, int]:
    match = PERIOD_RE.match(period)
    if not match:
        raise PeriodError(f"period must look like 2026-10, got {period!r}")
    return int(match.group(1)), int(match.group(2))


def next_period(period: str) -> str:
    year, month = parse_period(period)
    if month == 12:
        return f"{year + 1}-01"
    return f"{year}-{month + 1:02d}"


def zone(name: str) -> ZoneInfo:
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise PeriodError(f"unknown time zone {name!r}") from exc


def to_stored(moment: datetime) -> str:
    """Format an aware datetime the way usage timestamps are stored."""
    return moment.astimezone(UTC).strftime(STORED_FORMAT)


def month_bounds(period: str, tz_name: str) -> tuple[str, str]:
    """Return the UTC start of ``period`` and the UTC start of the next one."""
    tz = zone(tz_name)
    year, month = parse_period(period)
    next_year, next_month = parse_period(next_period(period))
    start = datetime(year, month, 1, tzinfo=tz)
    end = datetime(next_year, next_month, 1, tzinfo=tz)
    return to_stored(start), to_stored(end)


def parse_timestamp(text: str) -> datetime:
    """Read an ISO 8601 timestamp that carries an offset or ``Z``."""
    cleaned = text.strip()
    try:
        moment = datetime.fromisoformat(cleaned)
    except ValueError as exc:
        raise PeriodError(f"not an ISO 8601 timestamp: {text!r}") from exc
    if moment.tzinfo is None:
        raise PeriodError(f"timestamp has no offset: {text!r}")
    return moment


def current_period(tz_name: str, now: datetime | None = None) -> str:
    moment = (now or datetime.now(UTC)).astimezone(zone(tz_name))
    return f"{moment.year}-{moment.month:02d}"
