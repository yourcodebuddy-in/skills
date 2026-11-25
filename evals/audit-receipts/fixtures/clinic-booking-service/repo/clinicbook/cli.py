"""Command line: python -m clinicbook <command>. docs/operations.md lists the commands."""

from __future__ import annotations

import argparse
import getpass
import logging
import os
import sqlite3
import sys
from pathlib import Path

from clinicbook import auth, clinics, config as settings, db, gateways, importer, migrate, outbox, practitioners
from clinicbook.constants import RETENTION_DAYS
from clinicbook.errors import AppError
from clinicbook.logging_setup import configure
from clinicbook.timeutil import utcnow
from clinicbook.validation import MIN_PASSWORD_LENGTH

log = logging.getLogger("clinicbook")

PASSWORD_ENV = "CLINICBOOK_NEW_PASSWORD"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="clinicbook", description="Clinic appointment booking service")
    parser.add_argument("--config", help="JSON settings file read after config/default.json")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("serve", help="run the HTTP API")
    worker = sub.add_parser("worker", help="run the background worker")
    worker.add_argument("--once", action="store_true", help="run a single tick and exit")

    mig = sub.add_parser("migrate", help="apply database migrations")
    mig.add_argument("--to", type=int, help="stop after this migration number")

    clinic = sub.add_parser("create-clinic", help="add a clinic")
    clinic.add_argument("slug")
    clinic.add_argument("name")
    clinic.add_argument("timezone", help="IANA zone, such as America/Chicago")
    clinic.add_argument("--currency", default="USD")

    user = sub.add_parser("create-user", help=f"add an admin or staff account; password from ${PASSWORD_ENV} or a prompt")
    user.add_argument("clinic", help="clinic slug")
    user.add_argument("email")
    user.add_argument("role", choices=["admin", "staff"])

    prac = sub.add_parser("add-practitioner", help="add a practitioner to a clinic")
    prac.add_argument("clinic", help="clinic slug")
    prac.add_argument("name")
    prac.add_argument("--specialty", default="")
    prac.add_argument("--slot-minutes", type=int, default=30)
    prac.add_argument("--price-cents", type=int, required=True)

    hours = sub.add_parser("add-hours", help="add a block of working hours")
    hours.add_argument("clinic", help="clinic slug")
    hours.add_argument("practitioner_id", type=int)
    hours.add_argument("weekday", type=int, help="0 is Monday")
    hours.add_argument("start", help="HH:MM")
    hours.add_argument("end", help="HH:MM")

    off = sub.add_parser("deactivate-practitioner", help="stop new bookings with a practitioner")
    off.add_argument("clinic", help="clinic slug")
    off.add_argument("practitioner_id", type=int)

    imp = sub.add_parser("import-patients", help="import patients from a CSV file")
    imp.add_argument("clinic", help="clinic slug")
    imp.add_argument("csv_path")

    failed = sub.add_parser("outbox-failed", help="list messages that could not be delivered")
    failed.add_argument("--clinic", help="clinic slug")

    sub.add_parser("purge", help=f"delete expired sessions and sign-in attempts older than {RETENTION_DAYS} days")

    backup = sub.add_parser("backup", help="copy the database to a new file")
    backup.add_argument("dest")
    return parser


def _new_password() -> str:
    password = os.environ.get(PASSWORD_ENV) or getpass.getpass("Password: ")
    if len(password) < MIN_PASSWORD_LENGTH:
        raise AppError(f"password must be at least {MIN_PASSWORD_LENGTH} characters")
    return password


def _serve(config: settings.Config) -> int:
    from clinicbook.web.app import App
    from clinicbook.web.server import make_server

    app = App(config, gateways.sms_from_config(config), gateways.payments_from_config(config))
    server = make_server(app, config.host, config.port)
    log.info("listening on %s:%s", config.host, config.port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


def _worker(config: settings.Config, once: bool) -> int:
    from clinicbook.worker import Worker

    worker = Worker(config.db_path, gateways.sms_from_config(config), gateways.payments_from_config(config))
    if once:
        print(worker.tick())
        return 0
    try:
        worker.run(config.worker_interval_seconds)
    except KeyboardInterrupt:
        pass
    return 0


def _backup(conn: sqlite3.Connection, dest: str) -> int:
    target = Path(dest)
    if target.exists():
        print(f"{target} already exists; choose a new file", file=sys.stderr)
        return 1
    copy = sqlite3.connect(target)
    try:
        conn.backup(copy)
    finally:
        copy.close()
    print(f"backup written to {target}")
    return 0


def _run(args: argparse.Namespace, config: settings.Config) -> int:
    if args.command == "serve":
        return _serve(config)
    if args.command == "worker":
        return _worker(config, args.once)
    now = utcnow()
    conn = db.connect(config.db_path)
    try:
        if args.command == "migrate":
            ran = migrate.migrate(conn, now=now, target=args.to)
            print("\n".join(ran) if ran else "database is up to date")
        elif args.command == "create-clinic":
            clinic = clinics.create_clinic(conn, args.slug, args.name, args.timezone, args.currency, now)
            print(f"created clinic {clinic.slug} (id {clinic.id})")
        elif args.command == "create-user":
            clinic = clinics.get_clinic_by_slug(conn, args.clinic)
            password_hash = auth.hash_password(_new_password())
            user_id = auth.create_user(conn, clinic.id, args.email, password_hash, args.role, now)
            print(f"created {args.role} {args.email} (id {user_id})")
        elif args.command == "add-practitioner":
            clinic = clinics.get_clinic_by_slug(conn, args.clinic)
            pid = practitioners.create_practitioner(
                conn, clinic.id, args.name, args.specialty, args.slot_minutes, args.price_cents
            )
            print(f"created practitioner {pid}")
        elif args.command == "add-hours":
            clinic = clinics.get_clinic_by_slug(conn, args.clinic)
            practitioner = practitioners.get_practitioner(conn, clinic.id, args.practitioner_id)
            practitioners.add_working_hours(conn, practitioner.id, args.weekday, args.start, args.end)
            print("hours added")
        elif args.command == "deactivate-practitioner":
            clinic = clinics.get_clinic_by_slug(conn, args.clinic)
            practitioners.deactivate(conn, clinic.id, args.practitioner_id)
            print("practitioner deactivated; existing bookings are kept")
        elif args.command == "import-patients":
            clinic = clinics.get_clinic_by_slug(conn, args.clinic)
            with open(args.csv_path, newline="", encoding="utf-8-sig") as stream:
                result = importer.import_patients(conn, clinic.id, stream, now)
            print(f"created {result.created}, skipped {result.skipped} already on file, {len(result.errors)} errors")
            for error in result.errors:
                print(f"  {error}", file=sys.stderr)
            return 1 if result.errors else 0
        elif args.command == "outbox-failed":
            clinic_id = clinics.get_clinic_by_slug(conn, args.clinic).id if args.clinic else None
            for row in outbox.failed(conn, clinic_id):
                print(f"{row['id']}\tclinic {row['clinic_id']}\t{row['kind']}\t{row['recipient']}\t{row['last_error']}")
        elif args.command == "purge":
            sessions, attempts = auth.purge(conn, now, RETENTION_DAYS)
            print(f"deleted {sessions} expired sessions and {attempts} old sign-in attempts")
        elif args.command == "backup":
            return _backup(conn, args.dest)
        return 0
    finally:
        conn.close()


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    config = settings.load(args.config)
    configure(config.log_level)
    try:
        return _run(args, config)
    except AppError as exc:
        print(f"error: {exc.message}", file=sys.stderr)
        return 2
    except migrate.MigrationError as exc:
        print(f"migration failed: {exc}", file=sys.stderr)
        return 1
