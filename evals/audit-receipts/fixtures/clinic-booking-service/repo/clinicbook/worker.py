"""Background worker: queues reminders, sends the outbox and charges fees, once per tick."""

from __future__ import annotations

import logging
import sqlite3
import threading
from collections.abc import Callable
from datetime import datetime

from clinicbook import db, outbox
from clinicbook.constants import FEE_BATCH_SIZE, OUTBOX_BATCH_SIZE
from clinicbook.fees import REASONS
from clinicbook.formatting import format_money
from clinicbook.gateways.payments import PaymentDeclined
from clinicbook.gateways.sms import DeliveryFailed
from clinicbook.reminders import enqueue_due_reminders, fee_receipt_text
from clinicbook.timeutil import to_db, utcnow

log = logging.getLogger(__name__)


def deliver_outbox(conn: sqlite3.Connection, sms, now: datetime, limit: int = OUTBOX_BATCH_SIZE) -> int:
    """Send due messages at most once each (docs/adr/0006). Returns how many the provider accepted."""
    sent = 0
    for row in outbox.claim_due(conn, now, limit):
        try:
            sms.send(row["recipient"], row["body"])
        except Exception as exc:
            reason = str(exc) if isinstance(exc, DeliveryFailed) else f"{type(exc).__name__}: {exc}"
            outbox.mark_failed(conn, row["id"], reason)
            log.warning("message %s was not delivered: %s", row["id"], reason)
            continue
        sent += 1
    return sent


def run_fee_jobs(conn: sqlite3.Connection, payments, now: datetime, limit: int = FEE_BATCH_SIZE) -> int:
    """Charge pending fees. Returns how many were charged."""
    jobs = conn.execute(
        "SELECT f.id, f.clinic_id, f.booking_id, f.card_ref, f.reason, f.amount_cents, f.currency,"
        " c.name AS clinic_name, pt.phone"
        " FROM fee_jobs f JOIN clinics c ON c.id = f.clinic_id JOIN patients pt ON pt.id = f.patient_id"
        " WHERE f.status = 'pending' ORDER BY f.id LIMIT ?",
        (limit,),
    ).fetchall()
    results = []
    for job in jobs:
        description = f"{job['clinic_name']}: {REASONS[job['reason']]}, booking {job['booking_id']}"
        try:
            charge_id = payments.charge(job["card_ref"], job["amount_cents"], job["currency"], description)
        except PaymentDeclined as exc:
            log.info("fee %s declined: %s", job["id"], exc)
            results.append((job, "declined", None))
            continue
        results.append((job, "charged", charge_id))
    with db.transaction(conn):
        for job, status, charge_id in results:
            conn.execute(
                "UPDATE fee_jobs SET status = ?, gateway_ref = ?, charged_at = ? WHERE id = ?",
                (status, charge_id, to_db(now) if charge_id else None, job["id"]),
            )
            if status == "charged":
                amount_text = format_money(job["amount_cents"], job["currency"])
                outbox.enqueue(
                    conn,
                    clinic_id=job["clinic_id"],
                    booking_id=job["booking_id"],
                    kind="fee_receipt",
                    recipient=job["phone"],
                    body=fee_receipt_text(job["clinic_name"], job["reason"], amount_text),
                    now=now,
                )
    return sum(1 for _, status, _ in results if status == "charged")


class Worker:
    def __init__(self, db_path: str, sms, payments, clock: Callable[[], datetime] = utcnow) -> None:
        self.db_path = db_path
        self.sms = sms
        self.payments = payments
        self.clock = clock

    def tick(self) -> dict[str, int]:
        """Run every step once. A failing step is logged and runs again on the next tick."""
        now = self.clock()
        conn = db.connect(self.db_path)
        steps = {
            "reminders": lambda: enqueue_due_reminders(conn, now),
            "outbox": lambda: deliver_outbox(conn, self.sms, now),
            "fees": lambda: run_fee_jobs(conn, self.payments, now),
        }
        counts = {}
        try:
            for name, step in steps.items():
                try:
                    counts[name] = step()
                except Exception:
                    log.exception("worker step %s failed", name)
                    counts[name] = 0
        finally:
            conn.close()
        return counts

    def run(self, interval_seconds: float, stop: threading.Event | None = None) -> None:
        stop = stop or threading.Event()
        log.info("worker started, every %ss", interval_seconds)
        while not stop.is_set():
            counts = self.tick()
            if any(counts.values()):
                log.info("worker tick: %s", counts)
            stop.wait(interval_seconds)
