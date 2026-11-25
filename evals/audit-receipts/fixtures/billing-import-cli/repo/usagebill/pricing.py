"""Plans and usage pricing."""

import json
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path

from usagebill.models import InvoiceLine
from usagebill.money import AmountError, parse_decimal, to_cents


class PlanError(ValueError):
    """Raised when the plans file is malformed or a plan is missing."""


@dataclass(frozen=True)
class MetricPrice:
    metric: str
    label: str
    unit_cents: Decimal
    included: Decimal


@dataclass(frozen=True)
class Plan:
    code: str
    name: str
    currency: str
    base_cents: int
    metrics: dict[str, MetricPrice]


def _metric(code: str, metric: str, raw: dict) -> MetricPrice:
    try:
        unit = parse_decimal(str(raw["unit_cents"]))
        included = parse_decimal(str(raw.get("included", "0")))
    except (KeyError, AmountError) as exc:
        raise PlanError(f"plan {code}: bad price for {metric}: {exc}") from exc
    if unit < 0 or included < 0:
        raise PlanError(f"plan {code}: negative price or allowance for {metric}")
    return MetricPrice(metric=metric, label=raw.get("label", metric), unit_cents=unit, included=included)


def parse_plans(data: dict) -> dict[str, Plan]:
    plans: dict[str, Plan] = {}
    for code, raw in data.items():
        try:
            base = int(raw["base_cents"])
            currency = str(raw["currency"])
            metrics = raw["metrics"]
        except (KeyError, TypeError, ValueError) as exc:
            raise PlanError(f"plan {code}: missing or invalid field: {exc}") from exc
        plans[code] = Plan(
            code=code,
            name=raw.get("name", code),
            currency=currency,
            base_cents=base,
            metrics={metric: _metric(code, metric, spec) for metric, spec in metrics.items()},
        )
    return plans


def load_plans(path: str | Path) -> dict[str, Plan]:
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise PlanError(f"can't read plans from {path}: {exc}") from exc
    return parse_plans(data)


def billable_quantity(used: Decimal, price: MetricPrice) -> Decimal:
    return max(used - price.included, Decimal(0))


def line_amount_cents(used: Decimal, price: MetricPrice) -> int:
    return to_cents(billable_quantity(used, price) * price.unit_cents)


def price_usage(plan: Plan, totals: dict[str, Decimal]) -> list[InvoiceLine]:
    """Price one month of usage: the plan's base fee, then one line per metric used."""
    lines = [InvoiceLine(description=f"{plan.name} plan", amount_cents=plan.base_cents)]
    for metric in sorted(totals):
        price = plan.metrics.get(metric)
        if price is None:
            raise PlanError(f"plan {plan.code} has no price for {metric}")
        lines.append(
            InvoiceLine(
                description=price.label,
                amount_cents=line_amount_cents(totals[metric], price),
                metric=metric,
                quantity=totals[metric],
            )
        )
    return lines
