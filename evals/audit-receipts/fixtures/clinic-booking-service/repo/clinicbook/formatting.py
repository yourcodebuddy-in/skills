"""Text formatting for patient messages."""

from __future__ import annotations

from datetime import datetime

from clinicbook.constants import CURRENCY_SYMBOLS


def format_money(amount_cents: int, currency: str) -> str:
    symbol = CURRENCY_SYMBOLS.get(currency, f"{currency} ")
    whole, cents = divmod(amount_cents, 100)
    return f"{symbol}{whole:,}.{cents}"


def format_slot(local_start: datetime) -> str:
    """Tue 10 Mar at 09:00"""
    return local_start.strftime("%a %d %b at %H:%M")


def clean_name(name: str) -> str:
    return " ".join(name.split())
