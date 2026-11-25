"""Command-line entry point: ``python -m usagebill``."""

import argparse
import json
import logging
import re
import sqlite3
import sys
from collections.abc import Sequence
from datetime import UTC, datetime
from pathlib import Path

from usagebill import __version__, constants, export, importer, invoices, migrations, repository
from usagebill.config import ConfigError, Settings, load_settings
from usagebill.db import connect
from usagebill.discounts import DiscountError, parse_rule
from usagebill.formatting import format_cents
from usagebill.logging_setup import configure
from usagebill.periods import PeriodError, current_period, to_stored, zone
from usagebill.pricing import PlanError, load_plans
from usagebill.tax import RATES
from usagebill.webhook import WebhookRejected

log = logging.getLogger("usagebill.cli")

ACCOUNT_RE = re.compile(constants.ACCOUNT_PATTERN)


class UsageError(Exception):
    """Raised for bad command-line input; printed without a traceback."""


def _open(settings: Settings) -> sqlite3.Connection:
    conn = connect(settings.db_path)
    version = migrations.current_version(conn)
    if version != migrations.LATEST_VERSION:
        conn.close()
        raise UsageError(f"database is at version {version}; run `usagebill migrate` first")
    return conn


def cmd_migrate(args: argparse.Namespace, settings: Settings) -> int:
    conn = connect(settings.db_path)
    try:
        applied = migrations.migrate(conn)
    finally:
        conn.close()
    if applied:
        print(f"applied migrations: {', '.join(str(v) for v in applied)}")
    else:
        print("database is up to date")
    return 0


def cmd_customers_add(args: argparse.Namespace, settings: Settings) -> int:
    if not ACCOUNT_RE.match(args.account):
        raise UsageError("account must be 2-32 lowercase letters, digits or dashes")
    if args.country.upper() not in RATES:
        raise UsageError(f"no tax rate for country {args.country}")
    zone(args.timezone)
    if args.discount:
        parse_rule(args.discount)
    plans = load_plans(settings.plans_path)
    if args.plan not in plans:
        raise UsageError(f"unknown plan {args.plan}; choose from {', '.join(sorted(plans))}")
    conn = _open(settings)
    try:
        with conn:
            repository.add_customer(
                conn,
                account=args.account,
                name=args.name,
                plan=args.plan,
                country=args.country,
                timezone=args.timezone,
                vat_id=args.vat_id,
                discount=args.discount,
                created_at=to_stored(datetime.now(UTC)),
            )
    except sqlite3.IntegrityError as exc:
        raise UsageError(f"account {args.account} already exists") from exc
    finally:
        conn.close()
    print(f"added {args.account}")
    return 0


def cmd_import(args: argparse.Namespace, settings: Settings) -> int:
    plans = load_plans(settings.plans_path)
    conn = _open(settings)
    try:
        result = importer.import_file(conn, Path(args.file), args.account, plans, dry_run=args.dry_run)
    except importer.ImportRejected as exc:
        for error in exc.errors:
            print(f"error: {error}", file=sys.stderr)
        return 1
    finally:
        conn.close()
    verb = "would import" if result.dry_run else "imported"
    print(f"{verb} {result.rows} rows from {args.file}")
    return 0


def cmd_invoice_generate(args: argparse.Namespace, settings: Settings) -> int:
    plans = load_plans(settings.plans_path)
    conn = _open(settings)
    try:
        result = invoices.generate(conn, args.period, plans, account=args.account)
    finally:
        conn.close()
    print(f"created {len(result.created)}, replaced {len(result.replaced)}, left {len(result.skipped)} finalized")
    return 0


def cmd_invoice_finalize(args: argparse.Namespace, settings: Settings) -> int:
    conn = _open(settings)
    try:
        count = invoices.finalize(conn, args.period)
    finally:
        conn.close()
    print(f"finalized {count} invoices for {args.period}")
    return 0


def cmd_invoice_list(args: argparse.Namespace, settings: Settings) -> int:
    conn = _open(settings)
    try:
        try:
            rows = repository.list_invoices(conn, status=args.status, sort=args.sort, descending=args.desc)
        except ValueError as exc:
            raise UsageError(str(exc)) from exc
        for row in rows:
            print(f"{row['number']}\t{row['period']}\t{row['status']}\t{format_cents(row['total_cents'])}\t{row['account']}")
    finally:
        conn.close()
    return 0


def cmd_preview(args: argparse.Namespace, settings: Settings) -> int:
    plans = load_plans(settings.plans_path)
    conn = _open(settings)
    try:
        customer = repository.get_customer(conn, args.account)
        if customer is None:
            raise UsageError(f"unknown account {args.account}")
        period = args.period or current_period(customer.timezone)
        estimate = invoices.preview(conn, args.account, period, plans)
    finally:
        conn.close()
    if args.json:
        print(json.dumps(estimate, indent=2))
        return 0
    for line in estimate["lines"]:
        print(f"{line['description']:<30} {format_cents(line['amount_cents']):>12}")
    print(f"{'Subtotal so far':<30} {format_cents(estimate['subtotal_cents']):>12} {estimate['currency']}")
    return 0


def cmd_export(args: argparse.Namespace, settings: Settings) -> int:
    conn = _open(settings)
    try:
        written = export.export_period(conn, args.period, args.out)
    finally:
        conn.close()
    print(f"wrote {len(written)} files to {args.out}")
    return 0


def cmd_send(args: argparse.Namespace, settings: Settings) -> int:
    conn = _open(settings)
    try:
        count = invoices.send_finalized(conn, settings)
    finally:
        conn.close()
    print(f"sent {count} invoices")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="usagebill", description="Import usage and bill customers monthly.")
    parser.add_argument("--version", action="version", version=f"usagebill {__version__}")
    commands = parser.add_subparsers(dest="command", required=True)

    commands.add_parser("migrate", help="create or upgrade the database").set_defaults(func=cmd_migrate)

    customers = commands.add_parser("customers", help="manage customers").add_subparsers(dest="action", required=True)
    add = customers.add_parser("add", help="add a customer")
    add.add_argument("--account", required=True)
    add.add_argument("--name", required=True)
    add.add_argument("--plan", required=True)
    add.add_argument("--country", required=True)
    add.add_argument("--timezone", default="UTC")
    add.add_argument("--vat-id")
    add.add_argument("--discount", help="percent:N[:CAP_CENTS] or fixed:CENTS")
    add.set_defaults(func=cmd_customers_add)

    imp = commands.add_parser("import", help="import one usage file")
    imp.add_argument("--account", required=True, help="the account the file was uploaded for")
    imp.add_argument("--dry-run", action="store_true", help="check the file without writing anything")
    imp.add_argument("file")
    imp.set_defaults(func=cmd_import)

    invoice = commands.add_parser("invoice", help="generate, finalize and list invoices").add_subparsers(
        dest="action", required=True
    )
    gen = invoice.add_parser("generate", help="create or refresh draft invoices for a month")
    gen.add_argument("--period", required=True)
    gen.add_argument("--account")
    gen.set_defaults(func=cmd_invoice_generate)
    fin = invoice.add_parser("finalize", help="finalize every draft for a month")
    fin.add_argument("--period", required=True)
    fin.set_defaults(func=cmd_invoice_finalize)
    lst = invoice.add_parser("list", help="list invoices")
    lst.add_argument("--status", choices=constants.INVOICE_STATUSES)
    lst.add_argument("--sort", default="period")
    lst.add_argument("--desc", action="store_true")
    lst.set_defaults(func=cmd_invoice_list)

    prev = commands.add_parser("preview", help="estimate a customer's month so far")
    prev.add_argument("--account", required=True)
    prev.add_argument("--period")
    prev.add_argument("--json", action="store_true")
    prev.set_defaults(func=cmd_preview)

    exp = commands.add_parser("export", help="write finalized invoices for a month to files")
    exp.add_argument("--period", required=True)
    exp.add_argument("--out", required=True)
    exp.set_defaults(func=cmd_export)

    commands.add_parser("send", help="post finalized invoices to the accounting system").set_defaults(func=cmd_send)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        settings = load_settings()
        configure(settings.log_level)
        return args.func(args, settings)
    except (UsageError, ConfigError, PlanError, PeriodError, DiscountError, LookupError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    except WebhookRejected as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
