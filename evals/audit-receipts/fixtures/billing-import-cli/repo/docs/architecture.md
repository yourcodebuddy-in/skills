# Architecture

`usagebill` is one Python package with a thin command-line layer on top. Everything runs on the billing host from cron or by hand; there's no server.

## Modules

```text
cli.py ──► importer.py ──► repository.py ──► SQLite
   │            │
   ├──► invoices.py ──► pricing.py, discounts.py, tax.py, money.py
   │            └──► webhook.py ──► accounting system (HTTPS)
   └──► export.py ──► formatting.py
```

- `cli.py` parses arguments, opens the database, and turns known errors into a message and an exit code. It holds no billing rules.
- `repository.py` holds all SQL. Its functions never commit; the caller owns the transaction.
- `importer.py` checks a usage file and writes it in one transaction (ADR 0002).
- `invoices.py` builds invoices from usage totals. `build_invoice` is pure: given a customer, plan, period and totals it returns an `Invoice` and touches nothing else, which is what most tests exercise.
- `pricing.py`, `discounts.py`, `tax.py` and `money.py` hold the billing rules. Amounts follow ADR 0001.
- `webhook.py` is the accounting system client. Its `send` and `sleep` are parameters so tests can run it without a network or a clock.
- `export.py` and `formatting.py` write invoice files for customers.

## Data

| Table | Holds |
| --- | --- |
| `customers` | One row per account: plan, country, VAT number, time zone, discount rule. |
| `import_batches` | One row per imported file, keyed by the file's SHA-256 so the same file can't be imported twice. |
| `usage_events` | One row per usage line, with the batch it came from. Timestamps are stored in UTC as `YYYY-MM-DDTHH:MM:SSZ`, so text comparison orders them correctly. |
| `invoices` | One row per customer and month (`UNIQUE (customer_id, period)`), with status `draft`, `finalized` or `sent`. |
| `invoice_lines` | The lines of each invoice, in order. |

The schema version is SQLite's `user_version`. `migrations.py` lists every version's SQL; `usagebill migrate` applies the missing ones, each in its own transaction. Commands other than `migrate` refuse to run on an out-of-date database.

## Periods and time zones

A period is a calendar month in the customer's time zone. `periods.month_bounds` turns a period into the UTC timestamps of its first instant and of the first instant of the next month, and invoices sum the usage between them. A London customer's October therefore starts at `2026-09-30T23:00:00Z` (BST) and ends at `2026-11-01T00:00:00Z` (GMT).

## Invoice lifecycle

```text
generate ──► draft ──► finalize ──► finalized ──► send ──► sent
   ▲           │
   └───────────┘  rerun replaces the draft in place
```

Only drafts change. `invoice generate` uses one upsert that only updates a row whose status is still `draft`, and rewrites the lines only when that upsert returned the invoice.

## Failure handling

- Import: any bad row refuses the file; nothing is written.
- Generate: each customer's invoice is its own transaction, so one failing customer doesn't roll back the others already done.
- Send: each invoice is marked sent in its own transaction once it's posted.
