"""Currency conversion between plan currencies."""

from decimal import Decimal

from usagebill.money import to_cents

RATES_TO_GBP = {
    "GBP": Decimal("1"),
    "EUR": Decimal("0.85"),
    "USD": Decimal("0.79"),
}


class UnknownCurrency(ValueError):
    """Raised for a currency with no conversion rate."""


def rate(from_currency: str, to_currency: str, rates: dict[str, Decimal] | None = None) -> Decimal:
    table = RATES_TO_GBP if rates is None else rates
    try:
        return table[from_currency] / table[to_currency]
    except KeyError as exc:
        raise UnknownCurrency(f"no rate for {exc.args[0]}") from exc


def convert_cents(
    cents: int,
    from_currency: str,
    to_currency: str,
    rates: dict[str, Decimal] | None = None,
) -> int:
    if from_currency == to_currency:
        return cents
    return to_cents(Decimal(cents) * rate(from_currency, to_currency, rates))
