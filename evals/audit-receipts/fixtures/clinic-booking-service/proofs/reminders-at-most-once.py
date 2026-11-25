"""ADR 0006 chooses at-most-once delivery: rows are marked sent before the provider call and failures are
not retried. The code does exactly that: no message is ever handed to the provider twice, concurrent
workers never share a row, and a failure is recorded as failed for the front desk."""
import os
import sys
import threading
from pathlib import Path

sys.dont_write_bytecode = True
sys.path[:0] = [os.getcwd(), os.path.join(os.getcwd(), "tests")]

import logging  # noqa: E402

from helpers import ClinicTestCase  # noqa: E402

from clinicbook import db, outbox, worker  # noqa: E402
from clinicbook.gateways.sms import DeliveryFailed  # noqa: E402

logging.disable(logging.CRITICAL)

adr = Path("docs/adr/0006-reminders-at-most-once.md").read_text()
if "marks each due message `sent` before handing it to the provider" not in adr:
    print("decision not found")
    sys.exit(1)


class CountingSms:
    def __init__(self, fail=(), crash=()):
        self.calls = []
        self.fail, self.crash = set(fail), set(crash)
        self.lock = threading.Lock()

    def send(self, to, body):
        with self.lock:
            self.calls.append(body)
        if body in self.fail:
            raise DeliveryFailed("rejected")
        if body in self.crash:
            raise ConnectionResetError("connection reset by peer")
        return "id"


problems = []
case = ClinicTestCase()
case.setUp()
try:
    def queue(n):
        return [
            outbox.enqueue(case.conn, clinic_id=case.east.id, booking_id=None, kind="t", recipient="+12125550142",
                           body=f"m{i}", now=case.now)
            for i in range(n)
        ]

    # Failures, expected and unexpected, are recorded and never retried; the rest of the batch still goes.
    queue(5)
    gateway = CountingSms(fail={"m1"}, crash={"m3"})
    for _ in range(3):
        worker.deliver_outbox(case.conn, gateway, case.now)
    statuses = dict(case.conn.execute("SELECT body, status FROM outbox").fetchall())
    if sorted(gateway.calls) != ["m0", "m1", "m2", "m3", "m4"]:
        problems.append(f"provider calls {gateway.calls}")
    if statuses != {"m0": "sent", "m1": "failed", "m2": "sent", "m3": "failed", "m4": "sent"}:
        problems.append(f"statuses {statuses}")

    # Two workers at once never send the same row.
    case.conn.execute("DELETE FROM outbox")
    queue(40)
    shared = CountingSms()
    barrier = threading.Barrier(2)

    def run():
        conn = db.connect(case.db_path)
        try:
            barrier.wait()
            worker.deliver_outbox(conn, shared, case.now)
        finally:
            conn.close()

    threads = [threading.Thread(target=run) for _ in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    if sorted(shared.calls) != sorted(f"m{i}" for i in range(40)):
        problems.append(f"concurrent workers sent {len(shared.calls)} messages for 40 rows")
finally:
    case.doCleanups()
print("problems:", problems or "none")
sys.exit(0 if not problems else 1)
