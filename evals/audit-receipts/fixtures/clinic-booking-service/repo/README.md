# ClinicBook

Appointment booking for the Harbor Health group of clinics. Patients book, cancel and move appointments with a clinic's practitioners; front-desk staff manage the day; a background worker sends text-message reminders and charges late-cancellation and no-show fees; clinic admins export bookings as CSV.

Each clinic is a tenant with its own time zone, practitioners, patients and staff accounts. Staff and patients only ever see their own clinic.

Python 3.12 or later, standard library only. Data lives in one SQLite file.

## Quick start

```sh
python -m clinicbook migrate
python -m clinicbook create-clinic harbor-east "Harbor East" America/New_York
CLINICBOOK_NEW_PASSWORD='a long password' python -m clinicbook create-user harbor-east admin@harbor.example admin
python -m clinicbook add-practitioner harbor-east "Dr Ana Ruiz" --price-cents 12000
python -m clinicbook add-hours harbor-east 1 0 09:00 17:00
python -m clinicbook serve        # API on 127.0.0.1:8080
python -m clinicbook worker       # reminders, messages and fees
```

Without `CLINICBOOK_SMS_URL` and `CLINICBOOK_PAYMENTS_URL` the service writes messages and charges to the log instead of sending them, which is how development runs.

## Booking rules

- Slots come from each practitioner's weekly working hours, in the clinic's time zone. Patients can book up to 60 days ahead.
- A patient can hold at most three upcoming bookings at a clinic. A fourth is refused with `409 limit_reached` until one of them is cancelled or has passed.
- Cancelling 24 hours or more before the start is free. A patient who cancels later is charged 50% of the price, if they have a card on file. Cancellations made by the clinic are never charged.
- Patients can move a booking themselves up to 24 hours before it starts. After that they call the clinic, and staff can move it.
- A missed appointment, marked by staff after it ends, is charged at the full price if the patient has a card on file.
- Reminders are queued 24 hours before the appointment and sent by text to the patient's phone. Patients without a phone number get no messages.

Prices and fees are whole cents (see [ADR 0005](docs/adr/0005-money-in-integer-cents.md)). Cards are held by the payment provider; we store only its card reference.

## Configuration

Settings are read from `config/default.json`, then from the JSON file named by `--config` or `CLINICBOOK_CONFIG`, then from environment variables. Provider keys belong in the environment, never in a file.

| Setting | Variable | Default |
| --- | --- | --- |
| `db_path` | `CLINICBOOK_DB` | `clinicbook.sqlite3` |
| `host` | `CLINICBOOK_HOST` | `127.0.0.1` |
| `port` | `CLINICBOOK_PORT` | `8080` |
| `session_hours` | `CLINICBOOK_SESSION_HOURS` | `12` |
| `worker_interval_seconds` | `CLINICBOOK_WORKER_INTERVAL` | `60` |
| `sms_url` | `CLINICBOOK_SMS_URL` | none (log only) |
| `sms_api_key` | `CLINICBOOK_SMS_API_KEY` | none |
| `sms_sender` | `CLINICBOOK_SMS_SENDER` | `ClinicBook` |
| `sms_timeout_seconds` | `CLINICBOOK_SMS_TIMEOUT` | `10` |
| `payments_url` | `CLINICBOOK_PAYMENTS_URL` | none (log only) |
| `payments_api_key` | `CLINICBOOK_PAYMENTS_API_KEY` | none |
| `log_level` | `CLINICBOOK_LOG_LEVEL` | `INFO` |

## Tests

```sh
python -m unittest discover -s tests
```

The tests build a fresh database in a temp folder and use fake SMS and payment providers, so they need nothing running.

## Layout

| Path | What's there |
| --- | --- |
| `clinicbook/web/` | HTTP server, router and endpoints |
| `clinicbook/bookings.py`, `slots.py`, `fees.py` | Booking rules |
| `clinicbook/worker.py`, `outbox.py`, `reminders.py` | Background work and patient messages |
| `clinicbook/gateways/` | SMS and payment provider clients |
| `clinicbook/migrations/` | Numbered SQL migrations |
| `clinicbook/cli.py` | Command line |
| `docs/` | [API](docs/api.md), [architecture](docs/architecture.md), [operations](docs/operations.md), [security](docs/security.md), [decisions](docs/adr/) |
