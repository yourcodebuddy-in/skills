"""Sales tax by customer country.

The business is registered in Great Britain. EU business customers that give
a VAT number are invoiced under the reverse-charge rule, with no tax added.
"""

from decimal import Decimal

from usagebill.money import percent_of, to_cents

RATES = {
    "GB": Decimal("20"),
    "IE": Decimal("23"),
    "DE": Decimal("19"),
    "FR": Decimal("20"),
    "NL": Decimal("21"),
    "ES": Decimal("21"),
    "US": Decimal("0"),
    "CA": Decimal("0"),
    "AU": Decimal("0"),
}

EU_COUNTRIES = frozenset({"IE", "DE", "FR", "NL", "ES"})


class UnknownCountry(ValueError):
    """Raised when there's no tax rate for a country."""


def tax_rate(country: str, vat_id: str | None) -> Decimal:
    code = country.upper()
    if code not in RATES:
        raise UnknownCountry(f"no tax rate for country {country!r}")
    if code in EU_COUNTRIES and vat_id:
        return Decimal(0)
    return RATES[code]


def tax_cents(taxable_cents: int, rate: Decimal) -> int:
    if taxable_cents <= 0:
        return 0
    return to_cents(percent_of(taxable_cents, rate))
