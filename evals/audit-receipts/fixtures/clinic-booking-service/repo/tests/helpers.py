"""Shared set-up: a migrated database in a temp folder with two clinics, and fake providers."""

from __future__ import annotations

import json
import shutil
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

from clinicbook import auth, clinics, db, migrate, patients, practitioners
from clinicbook.config import Config
from clinicbook.gateways.payments import PaymentDeclined
from clinicbook.gateways.sms import DeliveryFailed
from clinicbook.timeutil import parse_local
from clinicbook.web.app import App

# Monday 2 March 2026, 10:00 in New York and 07:00 in Los Angeles.
NOW = datetime(2026, 3, 2, 15, 0, tzinfo=timezone.utc)
PASSWORD = "correct horse battery"
FAST_ITERATIONS = 1_000


def make_config(db_path: str) -> Config:
    return Config(
        db_path=db_path,
        host="127.0.0.1",
        port=0,
        session_hours=12,
        worker_interval_seconds=60,
        sms_url=None,
        sms_api_key=None,
        sms_sender="ClinicBook",
        sms_timeout_seconds=10.0,
        payments_url=None,
        payments_api_key=None,
        log_level="WARNING",
    )


class FakeSms:
    def __init__(self) -> None:
        self.sent: list[tuple[str, str]] = []
        self.failing_numbers: set[str] = set()

    def send(self, to: str, body: str) -> str:
        if to in self.failing_numbers:
            raise DeliveryFailed("number rejected")
        self.sent.append((to, body))
        return f"msg_{len(self.sent)}"


class FakePayments:
    def __init__(self) -> None:
        self.charges: list[tuple[str, int, str]] = []
        self.declined_cards: set[str] = set()

    def charge(self, card_ref: str, amount_cents: int, currency: str, description: str) -> str:
        if card_ref in self.declined_cards:
            raise PaymentDeclined("card declined")
        self.charges.append((card_ref, amount_cents, currency))
        return f"ch_{len(self.charges)}"


class ClinicTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = Path(tempfile.mkdtemp(prefix="clinicbook-test-"))
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        self.db_path = str(self.tmp / "test.sqlite3")
        self.conn = db.connect(self.db_path)
        self.addCleanup(self.conn.close)
        migrate.migrate(self.conn, now=NOW)
        self.now = NOW
        self.sms = FakeSms()
        self.payments = FakePayments()
        self.east = clinics.create_clinic(self.conn, "harbor-east", "Harbor East", "America/New_York", "USD", NOW)
        self.west = clinics.create_clinic(self.conn, "bayview-west", "Bayview West", "America/Los_Angeles", "USD", NOW)
        self.east_doc = self.add_practitioner(self.east, "Dr Ana Ruiz", price_cents=12000)
        self.west_doc = self.add_practitioner(self.west, "Dr Ben Okafor", price_cents=9000)

    def add_practitioner(self, clinic, name, *, price_cents=9000, slot_minutes=30, hours=("09:00", "17:00")):
        practitioner_id = practitioners.create_practitioner(
            self.conn, clinic.id, name, "General practice", slot_minutes, price_cents
        )
        for weekday in range(5):
            practitioners.add_working_hours(self.conn, practitioner_id, weekday, *hours)
        return practitioners.get_practitioner(self.conn, clinic.id, practitioner_id)

    def add_patient(self, clinic, email, *, name="Sam Lee", phone="212-555-0142", card_ref="card_ok"):
        return patients.create_patient(
            self.conn, clinic.id, name=name, email=email, phone=phone, card_ref=card_ref, now=NOW
        )

    def add_user(self, clinic, email, role, *, patient=None) -> str:
        """Create an account and return a session token for it."""
        password_hash = auth.hash_password(PASSWORD, iterations=FAST_ITERATIONS)
        auth.create_user(
            self.conn, clinic.id, email, password_hash, role, NOW, patient_id=patient.id if patient else None
        )
        return auth.login(self.conn, email, PASSWORD, NOW, 12)

    def book(self, clinic, practitioner, patient, local_start: str):
        from clinicbook import bookings

        return bookings.create_booking(self.conn, clinic, practitioner, patient, parse_local(local_start), self.now)

    def app(self) -> App:
        return App(make_config(self.db_path), self.sms, self.payments, clock=lambda: self.now)

    def call(self, method: str, path: str, *, token: str | None = None, body: object = None):
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        raw = json.dumps(body).encode() if body is not None else b""
        response = self.app().handle(method, path, headers, raw)
        if response.content_type.startswith("application/json"):
            return response.status, json.loads(response.body)
        return response.status, response.body.decode()
