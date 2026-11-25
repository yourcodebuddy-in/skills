# Kettle & Cup

The online shop for Kettle & Cup, a small coffee-gear business in Portland. Shoppers browse the
catalogue, fill a cart, check out and pay; staff ship orders, issue refunds, manage products and
discount codes, and read daily takings.

It runs on Node 26 with nothing to install: the standard library covers HTTP (`node:http`), the
database (`node:sqlite`), crypto and tests (`node:test`).

## Layout

```text
packages/
  core/       Prices, carts, coupons, orders and validation. No I/O except through the store it's given.
  db/         SQLite schema, migrations and one repository per table.
  payments/   The payment provider adapter (FakePay for now) and webhook signatures.
apps/
  api/        HTTP server: JSON API under /api, and the static web app everywhere else.
  web/        Storefront, cart, checkout, account and admin pages. Plain HTML, CSS and ES modules.
docs/         Architecture, API reference, runbook, review guide and decision records.
```

The workspaces import each other by relative path, so there is no build or link step
(see [ADR 0001](docs/adr/0001-workspaces-without-a-build-step.md)).

## Running it

```sh
npm run seed                                       # a few products and the WELCOME10 code
PAYMENT_WEBHOOK_SECRET=whsec_dev npm start         # http://127.0.0.1:3000
```

Register an account on the site, then give it staff access and open `/admin`:

```sh
node apps/api/scripts/make-admin.js you@example.com
```

Outside production, checkout ends on a stand-in for the provider's payment page with a
**Pay now** button, which completes the payment through FakePay.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3000` | Port to listen on |
| `HOST` | `127.0.0.1` | Address to bind |
| `DATABASE_FILE` | `data/shop.db` | SQLite file; created with its folder on first run |
| `PAYMENT_PROVIDER` | `fakepay` | Payment adapter to use |
| `PAYMENT_WEBHOOK_SECRET` | none, required | Secret the provider signs webhooks with |
| `SESSION_TTL_HOURS` | `12` | How long a sign-in lasts before the shopper has to sign in again |
| `WORKER_INTERVAL_MS` | `5000` | How often background jobs run: sending emails, cancelling unpaid orders |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn` or `error` |
| `NODE_ENV` | `development` | `production` turns on secure cookies and removes the stand-in payment page |

## How the shop works

**Money** is integer cents everywhere: in the database, in the API and in every calculation
([ADR 0002](docs/adr/0002-money-in-integer-cents.md)).

**Shipping** in the US is $5.99, and free when the goods come to $75 or more after any discount.
International orders pay $19.99. **Sales tax** of 8.25% applies to US orders, on the goods after
discount; exports are zero-rated.

**Discount codes** take a percentage or a fixed amount off, can have a minimum spend and a
maximum number of uses, and work up to and including their last day (UTC).

**Stock can't be oversold.** Checkout takes stock with a conditional update inside the order's
transaction, so when two shoppers race for the last unit, one order goes through and the other
gets `409 out_of_stock`, even if they check out at the same moment.

**Payments** go through the adapter in `packages/payments`. Checkout creates a payment intent;
the provider tells us the outcome with a signed webhook to `POST /api/webhooks/payments`, which
marks the order paid and queues the confirmation email. An order that isn't paid within 30
minutes is cancelled, and its stock and any discount-code use go back.

**Emails** are written to an outbox table in the same transaction as the change that causes them,
and a background worker in the API process sends them. Until a mail provider is chosen, they go
to the log.

## Tests

```sh
node --test
```

Runs every package's tests. The API tests run the whole app in-process against an in-memory
database and the fake provider, so they need no port and no network.

## More

- [Architecture](docs/architecture.md)
- [API reference](docs/api.md)
- [Runbook](docs/runbook.md)
- [Contributing](CONTRIBUTING.md) and the [review guide](docs/REVIEWING.md)
- [Decision records](docs/adr/)
