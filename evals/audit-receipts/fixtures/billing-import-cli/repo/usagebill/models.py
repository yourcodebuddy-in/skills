"""Records passed between the importer, pricing and storage."""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from sqlite3 import Row


@dataclass(frozen=True)
class Customer:
    id: int
    account: str
    name: str
    plan: str
    country: str
    vat_id: str | None
    timezone: str
    discount: str | None

    @classmethod
    def from_row(cls, row: Row) -> "Customer":
        return cls(
            id=row["id"],
            account=row["account"],
            name=row["name"],
            plan=row["plan"],
            country=row["country"],
            vat_id=row["vat_id"],
            timezone=row["timezone"],
            discount=row["discount"],
        )


@dataclass(frozen=True)
class InvoiceLine:
    description: str
    amount_cents: int
    metric: str | None = None
    quantity: Decimal | None = None


@dataclass(frozen=True)
class Invoice:
    customer_id: int
    period: str
    number: str
    lines: tuple[InvoiceLine, ...]
    subtotal_cents: int
    discount_cents: int
    tax_rate: Decimal
    tax_cents: int
    total_cents: int
    issued_on: date
    due_on: date


@dataclass(frozen=True)
class UsageEvent:
    customer_id: int
    metric: str
    quantity: Decimal
    occurred_at: str
