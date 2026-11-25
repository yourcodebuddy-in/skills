# usagebill

`usagebill` turns metered usage into monthly invoices. It imports the usage files customers upload, prices them against their plan, applies discounts and tax, keeps everything in one SQLite database, writes invoice files for customers, and posts finalized invoices to the accounting system.

It's a command-line tool and a small Python library with no third-party dependencies. It needs Python 3.12 or later.

## How a month runs

1. **Usage arrives.** Customers upload usage through the customer portal. The portal saves each upload to `inbox/<account>/` on the billing host.
2. **Nightly import.** The `usagebill-import` cron job runs `usagebill import --account <account> <file>` for each new file in that account's inbox folder, then moves the file to `inbox/<account>/done/`.
3. **Drafts.** On the 1st of each month, the billing team runs `usagebill invoice generate --period <last month>`. They can rerun it as often as they like while late files come in.
4. **Finalize.** After review, `usagebill invoice finalize --period <month>` locks that month's drafts.
5. **Export and send.** `usagebill export` writes the invoice files emailed to customers, and `usagebill send` posts the finalized invoices to the accounting system.

## Install

```sh
python3 -m venv .venv
. .venv/bin/activate
pip install -e .
```

Or run it in place with `python3 -m usagebill`.

## Commands

| Command | What it does |
| --- | --- |
| `usagebill migrate` | Create the database or bring it up to the latest schema. |
| `usagebill customers add --account ACCOUNT --name NAME --plan PLAN --country CC [--timezone TZ] [--vat-id ID] [--discount RULE]` | Add a customer. Accounts are 2–32 lowercase letters, digits or dashes. |
| `usagebill import --account ACCOUNT FILE [--dry-run]` | Import one usage file. `--dry-run` checks the file and writes nothing. |
| `usagebill invoice generate --period YYYY-MM [--account ACCOUNT]` | Create or refresh draft invoices for a month. |
| `usagebill invoice finalize --period YYYY-MM` | Finalize every draft for a month. |
| `usagebill invoice list [--status STATUS] [--sort FIELD] [--desc]` | List invoices. Sort by `period`, `account`, `number`, `status` or `total`. |
| `usagebill preview --account ACCOUNT [--period YYYY-MM] [--json]` | Show what a customer's invoice comes to so far, before discount and tax. |
| `usagebill export --period YYYY-MM --out DIR` | Write one CSV per finalized or sent invoice, plus `summary.json`. |
| `usagebill send` | Post every finalized invoice to the accounting system and mark it sent. |

Running `invoice generate` again for a month replaces that month's drafts in place, so you never get two invoices for one customer and month. An invoice that has been finalized or sent is never changed by a later run; it's reported as "left finalized".

## Usage files

A usage file is a CSV with a header row and these columns, in any order:

| Column | Example | Notes |
| --- | --- | --- |
| `account` | `northwind` | The customer's account. |
| `metric` | `api_calls` | Must be priced on the customer's plan. |
| `quantity` | `41250` or `12.5` | A plain decimal, zero or more. |
| `occurred_at` | `2026-10-01T00:00:00Z` | ISO 8601 with `Z` or an offset. Times in the future are refused. |

Most customers send one row per metric per day, stamped at midnight UTC. See `examples/usage-2026-10.csv`.

If any row is invalid the whole file is refused and nothing is written; the command prints up to 20 problems. Fix the file and import it again. A file whose exact contents were already imported is refused, so rerunning the nightly job is safe.

## Billing rules

- **Periods** are calendar months in the customer's own time zone (`--timezone`, default `UTC`).
- **Plans** live in `config/plans.json`. Each plan has a monthly base fee and a price per unit for each metric, with an optional allowance that's included free.
- **Amounts** are whole cents. Each line is rounded half up once; totals are sums of rounded lines. See `docs/adr/0001-money-in-integer-cents.md`.
- **Discounts** come off the subtotal before tax: `percent:10`, `percent:10:5000` (10%, at most 5000 cents), or `fixed:1500`.
- **Tax** is charged at the customer's country rate. EU business customers with a VAT number are reverse-charged at 0%.

## Configuration

Settings come from environment variables.

| Variable | Default | Meaning |
| --- | --- | --- |
| `USAGEBILL_DB` | `usagebill.db` | Path to the SQLite database. |
| `USAGEBILL_PLANS` | `config/plans.json` | Path to the plans file. |
| `USAGEBILL_DUE_DAYS` | `30` | Days between an invoice's issue date and its due date. |
| `USAGEBILL_WEBHOOK_URL` | none | The accounting system's invoice endpoint. Must be `https`. Needed by `send`. |
| `USAGEBILL_WEBHOOK_TOKEN` | none | Bearer token for the accounting system. Needed by `send`. |
| `USAGEBILL_LOG_LEVEL` | `INFO` | `DEBUG`, `INFO`, `WARNING` or `ERROR`. Logs go to stderr. |

## Sending to accounting

`usagebill send` posts each finalized invoice as JSON. A network error, a `429` or a `5xx` is retried up to 4 attempts in all, waiting 2, 10 and 30 seconds between them. Any other `4xx` stops the run with an error. Every post carries an `Idempotency-Key` header; see `docs/adr/0003-idempotent-webhook-posts.md`.

## Development

```sh
python3 -m unittest discover -s tests
```

Tests use temporary databases and never touch the network. See `CONTRIBUTING.md` for the workflow and `docs/` for design notes and decision records.

## Layout

```text
usagebill/       the package
  cli.py         argument parsing and commands
  importer.py    usage file checks and import
  invoices.py    building, storing and sending invoices
  pricing.py     plans and usage pricing
  discounts.py   discount rules
  tax.py         tax rates
  repository.py  all SQL
  migrations.py  schema versions
  export.py      invoice files
  webhook.py     accounting system client
config/          plans
deploy/          deploy script
docs/            architecture, operations, decision records
tests/           unit and command tests
```
