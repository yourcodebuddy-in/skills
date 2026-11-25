"""Decimal helpers for amounts held in cents."""

from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

WHOLE_CENT = Decimal("1")
HUNDRED = Decimal("100")


class AmountError(ValueError):
    """Raised when text can't be read as an amount or quantity."""


def parse_decimal(text: str) -> Decimal:
    """Read a plain decimal number such as ``12`` or ``0.375``.

    Exponents, infinities and NaN are refused so a stray value in a usage
    file can't turn into a huge or undefined charge.
    """
    cleaned = text.strip()
    if not cleaned:
        raise AmountError("empty value")
    try:
        value = Decimal(cleaned)
    except InvalidOperation as exc:
        raise AmountError(f"not a number: {text!r}") from exc
    if not value.is_finite() or "e" in cleaned.lower():
        raise AmountError(f"not a plain number: {text!r}")
    return value


def to_cents(amount: Decimal) -> int:
    """Round an amount in fractional cents to whole cents, half up."""
    return int(amount.quantize(WHOLE_CENT, rounding=ROUND_HALF_UP))


def percent_of(cents: int, percent: Decimal) -> Decimal:
    """Return ``percent`` per cent of ``cents``, unrounded."""
    return Decimal(cents) * percent / HUNDRED
