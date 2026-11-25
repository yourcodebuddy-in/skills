"""Customer discounts.

A customer's discount is stored as text:

- ``percent:10`` takes 10% off the subtotal
- ``percent:10:5000`` takes 10% off, but never more than 5000 cents
- ``fixed:1500`` takes 1500 cents off, but never more than the subtotal
"""

from dataclasses import dataclass
from decimal import Decimal

from usagebill.money import AmountError, parse_decimal, percent_of, to_cents


class DiscountError(ValueError):
    """Raised for a discount that can't be parsed."""


@dataclass(frozen=True)
class DiscountRule:
    kind: str
    value: Decimal
    max_cents: int | None = None


def parse_rule(text: str) -> DiscountRule:
    parts = text.strip().split(":")
    kind = parts[0]
    try:
        if kind == "percent" and len(parts) in (2, 3):
            value = parse_decimal(parts[1])
            cap = int(parts[2]) if len(parts) == 3 else None
            if not 0 < value <= 100 or (cap is not None and cap <= 0):
                raise DiscountError(f"discount out of range: {text!r}")
            return DiscountRule("percent", value, cap)
        if kind == "fixed" and len(parts) == 2:
            value = parse_decimal(parts[1])
            if value <= 0 or value != value.to_integral_value():
                raise DiscountError(f"fixed discount must be whole cents above zero: {text!r}")
            return DiscountRule("fixed", value)
    except DiscountError:
        raise
    except (AmountError, ValueError) as exc:
        raise DiscountError(f"bad discount {text!r}: {exc}") from exc
    raise DiscountError(f"discount must be percent:N[:CAP] or fixed:CENTS, got {text!r}")


def discount_cents(subtotal_cents: int, rule: DiscountRule) -> int:
    """Return how many cents to take off ``subtotal_cents`` (zero or more)."""
    if subtotal_cents <= 0:
        return 0
    if rule.kind == "percent":
        amount = to_cents(percent_of(subtotal_cents, rule.value))
        if rule.max_cents is not None:
            amount = min(amount, rule.max_cents)
        return amount
    return min(int(rule.value), subtotal_cents)
