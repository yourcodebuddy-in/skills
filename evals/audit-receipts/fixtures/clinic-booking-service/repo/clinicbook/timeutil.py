"""Time handling. Instants are stored as UTC text (see docs/adr/0002) and shown in the clinic's zone."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

DB_FORMAT = "%Y-%m-%dT%H:%M:%SZ"
LOCAL_FORMAT = "%Y-%m-%dT%H:%M"


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def zone(name: str) -> ZoneInfo:
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise ValueError(f"unknown time zone: {name}") from exc


def to_db(moment: datetime) -> str:
    if moment.tzinfo is None:
        raise ValueError("to_db needs an aware datetime")
    return moment.astimezone(timezone.utc).strftime(DB_FORMAT)


def from_db(text: str) -> datetime:
    return datetime.strptime(text, DB_FORMAT).replace(tzinfo=timezone.utc)


def local_to_utc(local: datetime, tz: str) -> datetime:
    """Read a naive wall-clock time in the clinic's zone and return the UTC instant."""
    if local.tzinfo is not None:
        raise ValueError("local_to_utc needs a naive datetime")
    return local.replace(tzinfo=zone(tz)).astimezone(timezone.utc)


def to_local(moment: datetime, tz: str) -> datetime:
    return moment.astimezone(zone(tz))


def local_today(now: datetime, tz: str) -> date:
    return to_local(now, tz).date()


def day_bounds(day: date, tz: str) -> tuple[str, str]:
    """Stored-format UTC instants for the start of a clinic day and the start of the next."""
    start = datetime.combine(day, time.min, tzinfo=zone(tz))
    end = datetime.combine(day + timedelta(days=1), time.min, tzinfo=zone(tz))
    return to_db(start), to_db(end)


def parse_day(text: str | None) -> date:
    if not text:
        raise ValueError("a date is required (YYYY-MM-DD)")
    try:
        return date.fromisoformat(text)
    except ValueError as exc:
        raise ValueError(f"not a date: {text!r} (use YYYY-MM-DD)") from exc


def parse_local(text: str) -> datetime:
    """Parse a clinic wall-clock time such as 2026-03-04T09:30."""
    try:
        parsed = datetime.strptime(text, LOCAL_FORMAT)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"not a local time: {text!r} (use YYYY-MM-DDTHH:MM)") from exc
    return parsed
