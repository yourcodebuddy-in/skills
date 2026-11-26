# Box Office

Ticket sales for small venues. Organisers put events on sale with a few seating tiers; buyers hold
seats for a few minutes while they pay; a worker releases holds that run out, emails tickets and
refunds everyone when an event is cancelled. Organisers get a sales report and a CSV of their orders.

It runs as two Node processes on one host, a web server and a worker, sharing one SQLite database.
There are no npm dependencies.

## Quick start

Needs Node 24 or later.

```sh
cp .env.example .env
set -a; . ./.env; set +a
node bin/boxoffice.js migrate
node bin/boxoffice.js tenant:create harbour-hall "Harbour Hall" --timezone Europe/London
node bin/boxoffice.js key:create harbour-hall "laptop"     # prints the API key once
node src/server.js                                       # http://localhost:3000
node src/worker/index.js                                 # in a second terminal
```

With `MAIL_TRANSPORT=log` emails are written to the log instead of being sent, and with
`MAIL_TRANSPORT=file` each one is saved as JSON under `MAIL_DIR`.

Run the tests with `node --test`.

## How a sale works

1. The organiser creates an event with its tiers (`POST /events`) and publishes it.
2. A buyer picks a tier and a number of seats. `POST /public/events/:id/holds` reserves them and
   returns a hold token. Nobody else can take those seats until the hold runs out.
3. The buyer pays: `POST /holds/:token/checkout` with a payment token from the provider's card
   form. The order is charged at the price the tier had when the hold was made, plus the booking fee.
4. The order gets its tickets, and the worker emails them with a link to the order.

A buyer is never charged twice for one hold, even if they press Pay twice or two app servers take
the two requests: one request charges the card and the other gets `409 payment_in_progress` or the
paid order.

Holds that run out are released by the worker, which runs every `WORKER_INTERVAL_SECONDS`.

When an organiser cancels an event, sales stop at once, open holds are released, every buyer is
told, and the worker refunds each paid order in full, booking fee included.

## Configuration

All settings come from environment variables.

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `DATABASE_PATH` | `./data/boxoffice.db` | SQLite file. The directory is created if missing |
| `PUBLIC_URL` | `http://localhost:3000` | Base of the order links in emails |
| `CURRENCY` | `EUR` | The one currency this deployment sells in |
| `HOLD_MINUTES` | `10` | How long a hold keeps its seats |
| `MAX_TICKETS_PER_HOLD` | `8` | Most seats one hold can take |
| `BOOKING_FEE_BPS` | `500` | Booking fee in basis points of the order subtotal (500 = 5%) |
| `MAX_BODY_BYTES` | `65536` | Largest request body accepted |
| `PAYMENTS_URL` | `http://localhost:4010` | Payment provider API |
| `PAYMENTS_API_KEY` | | Required in production |
| `PAYMENTS_WEBHOOK_SECRET` | | Required in production. Signs provider webhooks |
| `PAYMENTS_TIMEOUT_MS` | `10000` | Timeout for each call to the provider |
| `MAIL_TRANSPORT` | `log` | `log`, `file` or `http` |
| `MAIL_FROM` | `Box Office <tickets@localhost>` | Sender address |
| `MAIL_DIR` | `./data/mail` | Where the `file` transport writes |
| `MAIL_API_URL`, `MAIL_API_KEY` | | The mail provider's send endpoint, for `http` |
| `MAIL_TIMEOUT_MS` | `10000` | Timeout for each send |
| `WORKER_INTERVAL_SECONDS` | `30` | How often the worker runs |
| `WORKER_BATCH_SIZE` | `50` | Most jobs and emails handled per run |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn` or `error` |

## Command line

```text
node bin/boxoffice.js migrate [--status]
node bin/boxoffice.js tenant:create <slug> <name> [--timezone <tz>]
node bin/boxoffice.js tenant:list
node bin/boxoffice.js key:create <tenant-slug> [label]
node bin/boxoffice.js key:list <tenant-slug>
node bin/boxoffice.js key:revoke <prefix>
node bin/boxoffice.js holds:expire
node bin/boxoffice.js tickets:resend <order-token>
node bin/boxoffice.js mail:retry
node bin/boxoffice.js stats
```

## Layout

```text
bin/          command line
migrations/   SQL migrations, applied in order by `migrate`
src/app.js    routes requests to handlers; src/server.js puts it on node:http
src/routes/   organiser, buyer and webhook routes
src/services/ events, holds, orders, refunds, reports, tenants
src/worker/   the worker loop and its jobs
src/mail/     outbox, templates and transports
src/payments/ payment provider client and webhook signatures
docs/         API, architecture, operations and decision records
```

## Documentation

- [API](docs/api.md)
- [Architecture](docs/architecture.md)
- [Operations](docs/operations.md)
- [Decision records](docs/adr/)
- [Contributing](CONTRIBUTING.md)
