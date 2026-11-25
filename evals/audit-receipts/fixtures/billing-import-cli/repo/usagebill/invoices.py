"""Building, storing and sending monthly invoices."""

import logging
import sqlite3
import time
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from usagebill import constants, repository, webhook
from usagebill.config import Settings
from usagebill.discounts import discount_cents, parse_rule
from usagebill.models import Customer, Invoice, InvoiceLine
from usagebill.periods import month_bounds, parse_period, to_stored
from usagebill.pricing import Plan, PlanError, price_usage
from usagebill.tax import tax_cents, tax_rate

log = logging.getLogger(__name__)


@dataclass
class GenerateResult:
    created: list[str] = field(default_factory=list)
    replaced: list[str] = field(default_factory=list)
    skipped: list[str] = field(default_factory=list)


def invoice_number(period: str, account: str) -> str:
    year, month = parse_period(period)
    return f"{year}{month:02d}-{account.upper()}"


def build_invoice(
    customer: Customer,
    plan: Plan,
    period: str,
    totals: dict[str, Decimal],
    issued_on: date,
) -> Invoice:
    """Price a month of usage for one customer. Pure: reads and writes nothing."""
    plan_lines = price_usage(plan, totals)
    lines = list(plan_lines)
    subtotal = sum(line.amount_cents for line in plan_lines)

    discount = 0
    if customer.discount:
        discount = discount_cents(subtotal, parse_rule(customer.discount))
    if discount:
        lines.append(InvoiceLine(description="Discount", amount_cents=-discount))

    rate = tax_rate(customer.country, customer.vat_id)
    taxable = subtotal - discount
    tax = tax_cents(taxable, rate)
    return Invoice(
        customer_id=customer.id,
        period=period,
        number=invoice_number(period, customer.account),
        lines=tuple(lines),
        subtotal_cents=subtotal,
        discount_cents=discount,
        tax_rate=rate,
        tax_cents=tax,
        total_cents=taxable + tax,
        issued_on=issued_on,
        due_on=issued_on + timedelta(days=constants.DEFAULT_DUE_DAYS),
    )


def generate(
    conn: sqlite3.Connection,
    period: str,
    plans: dict[str, Plan],
    *,
    account: str | None = None,
    today: date | None = None,
    now: datetime | None = None,
) -> GenerateResult:
    """Create or refresh draft invoices for ``period``.

    A draft is replaced in place. An invoice that has been finalized or sent
    is left exactly as it is.
    """
    issued_on = today or date.today()
    stamp = to_stored(now or datetime.now(UTC))
    result = GenerateResult()
    if account is None:
        customers = repository.list_customers(conn)
    else:
        customer = repository.get_customer(conn, account)
        if customer is None:
            raise LookupError(f"unknown account {account!r}")
        customers = [customer]

    for customer in customers:
        plan = plans.get(customer.plan)
        if plan is None:
            raise PlanError(f"account {customer.account} is on unknown plan {customer.plan!r}")
        start, end = month_bounds(period, customer.timezone)
        totals = repository.usage_totals(conn, customer.id, start, end)
        invoice = build_invoice(customer, plan, period, totals, issued_on)
        with conn:
            existed = repository.find_invoice(conn, customer.id, period) is not None
            invoice_id = repository.save_draft(conn, invoice, stamp)
            if invoice_id is None:
                result.skipped.append(invoice.number)
                continue
            repository.replace_lines(conn, invoice_id, invoice.lines)
        (result.replaced if existed else result.created).append(invoice.number)
    return result


def finalize(conn: sqlite3.Connection, period: str) -> int:
    parse_period(period)
    with conn:
        return repository.finalize_period(conn, period)


def preview(conn: sqlite3.Connection, account: str, period: str, plans: dict[str, Plan]) -> dict:
    """Estimate the month so far for one customer, before discount and tax."""
    customer = repository.get_customer(conn, account)
    if customer is None:
        raise LookupError(f"unknown account {account!r}")
    plan = plans[customer.plan]
    start, end = month_bounds(period, customer.timezone)
    totals = repository.usage_totals(conn, customer.id, start, end)
    rows = [{"description": f"{plan.name} plan", "amount_cents": plan.base_cents}]
    for metric, used in sorted(totals.items()):
        price = plan.metrics[metric]
        billable = max(used - price.included, 0)
        rows.append({"description": price.label, "amount_cents": round(billable * price.unit_cents)})
    return {
        "account": customer.account,
        "period": period,
        "currency": plan.currency,
        "lines": rows,
        "subtotal_cents": sum(row["amount_cents"] for row in rows),
    }


def send_finalized(
    conn: sqlite3.Connection,
    settings: Settings,
    *,
    send: webhook.Send = webhook.http_send,
    sleep: webhook.Sleep = time.sleep,
    now: datetime | None = None,
) -> int:
    """Post every finalized invoice to the accounting system and mark it sent."""
    url, token = settings.require_webhook()
    sent = 0
    for invoice in repository.invoices_by_status(conn, "finalized"):
        lines = repository.invoice_lines(conn, invoice["id"])
        payload = webhook.invoice_payload(invoice, lines)
        webhook.post_invoice(url, token, payload, send=send, sleep=sleep)
        with conn:
            repository.mark_sent(conn, invoice["id"], to_stored(now or datetime.now(UTC)))
        sent += 1
        log.info("sent %s", invoice["number"])
    return sent
