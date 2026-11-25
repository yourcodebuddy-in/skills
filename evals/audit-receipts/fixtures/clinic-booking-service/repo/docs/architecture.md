# Architecture

Two processes share one SQLite database file ([ADR 0001](adr/0001-sqlite-single-file.md)):

- **`serve`** runs the HTTP API (`clinicbook/web/`). `server.py` reads requests off the socket and passes the method, path, headers and body to `App.handle` in `app.py`, which signs the caller in, finds the route and calls a handler in `handlers.py`. Handlers turn JSON into calls on the domain modules and the results back into JSON. Each request gets its own connection.
- **`worker`** runs `Worker.tick` every `worker_interval_seconds`. A tick has three steps, each run even if an earlier one failed:
  1. `reminders.enqueue_due_reminders` queues a reminder for every booking starting within 24 hours that hasn't had one.
  2. `worker.deliver_outbox` sends due outbox messages through the SMS provider ([ADR 0006](adr/0006-reminders-at-most-once.md)).
  3. `worker.run_fee_jobs` charges pending late-cancellation and no-show fees through the payment provider and queues a receipt for each charge.

Run exactly one worker. Several API processes are fine.

## Domain modules

| Module | Owns |
| --- | --- |
| `clinics.py` | Clinics, the tenants. Each has a slug, a time zone and a currency |
| `practitioners.py` | Practitioners, prices, slot lengths and weekly working hours |
| `patients.py` | Patient records, one per person per clinic |
| `slots.py` | Turning working hours into bookable slots in the clinic's zone |
| `bookings.py` | Creating, cancelling, moving and closing bookings |
| `fees.py` | Fee amounts and the fee queue |
| `outbox.py` | The message queue ([ADR 0004](adr/0004-patient-messages-through-the-outbox.md)) |
| `reminders.py` | Message texts and reminder queueing |
| `export.py` | The admin CSV export |
| `importer.py` | Bulk patient import from a clinic's previous system |
| `auth.py` | Accounts, password hashes and sessions |

## Data

```text
clinics 1─* practitioners 1─* working_hours
clinics 1─* patients 1─* bookings *─1 practitioners
clinics 1─* users (admin, staff, or patient linked to one patients row)
bookings 1─* outbox, bookings 1─* fee_jobs
```

Every table that holds a clinic's data has a `clinic_id`. Requests are scoped by it ([ADR 0003](adr/0003-tenant-scoping.md)).

Instants are stored as UTC text in one fixed format ([ADR 0002](adr/0002-utc-text-timestamps.md)). A booking's `price_cents` is copied from the practitioner when it's made, so a later price change doesn't alter existing bookings or their fees.

## Transactions

Connections run in autocommit mode. Anything that reads and then writes, or writes more than one row that must change together, runs inside `db.transaction(conn, immediate=True)`, which takes SQLite's write lock at `BEGIN`. That's how booking a slot and the three-bookings limit hold when two requests arrive together.
