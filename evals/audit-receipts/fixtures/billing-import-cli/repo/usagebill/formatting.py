"""Text formats used in exports and command output."""

from datetime import date
from decimal import Decimal

from usagebill.periods import parse_period

MONTHS = (
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
)


def format_cents(cents: int) -> str:
    units, rest = divmod(cents, 100)
    return f"{units}.{rest:02d}"


def format_quantity(quantity: Decimal | None) -> str:
    if quantity is None:
        return ""
    text = format(quantity.normalize(), "f")
    return text


def format_period(period: str) -> str:
    year, month = parse_period(period)
    return f"{MONTHS[month - 1]} {year}"


def format_date(value: date) -> str:
    return value.strftime("%d %b %Y")
