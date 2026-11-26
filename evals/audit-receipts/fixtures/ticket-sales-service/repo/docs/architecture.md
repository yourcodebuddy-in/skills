# Architecture

## Processes

```text
            buyers, organisers                 payment provider
                    |                          |            ^
                    v                          | webhooks   | charges, refunds
             +-------------+                   v            |
             |  web server | <-----------------+------------+
             +-------------+
                    |  SQLite (WAL), one file
             +-------------+
             |   worker    | ---> mail provider
             +-------------+
```

- **Web server** (`src/server.js`): the HTTP API for organisers and buyers, and the payment
  webhook. Charges cards during checkout and refunds single orders when an organiser asks.
- **Worker** (`src/worker/index.js`): every `WORKER_INTERVAL_SECONDS` it expires holds that have run
  out, runs due jobs from the `jobs` table, and sends a batch of email from the `outbox` table.
- **SQLite**: one database file on the host's disk, shared by both processes (ADR 0001).

## Request handling

`src/app.js` turns a request into a response without touching sockets: it matches the route, parses
the body on demand, runs the handler and maps `HttpError`s to JSON error bodies. `src/server.js`
adapts it to `node:http`. Tests call `app.handle` directly.

Organiser routes authenticate with an API key (`Authorization: Bearer bo_<prefix>_<secret>`). Keys
are stored as a prefix and a SHA-256 hash of the secret. Every organiser query is scoped to the
tenant that owns the key.

Buyer routes have no login. Holds and orders are reached by 128-bit random tokens (ADR 0004).

## Data

| Table | Holds |
| --- | --- |
| `tenants`, `api_keys` | Organisers and their keys |
| `events`, `tiers` | What is on sale, and at what price and capacity |
| `holds` | Seats reserved by a buyer, with the price at the time and an expiry |
| `orders`, `tickets` | Paid (or being paid) holds and the tickets issued for them |
| `refunds` | Money returned, per order, with the provider's reference |
| `outbox` | Email waiting to be sent (ADR 0003) |
| `jobs` | Background work such as refunding a cancelled event |

Every write that has to happen together runs in `transaction()`, which opens with
`BEGIN IMMEDIATE` so the write lock is taken before anything is read.

## Money

Whole cents in integers, one currency per deployment (ADR 0002). An order stores its subtotal, fee
and total. Prices are fixed when the hold is made (see "How a sale works" in the README).

## Seat availability

A tier's free seats are its capacity, less tickets sold and not refunded, less seats in active holds.
Holds stay active until the worker expires them, even after their expiry time (ADR 0005).

## Background jobs

`enqueueJob` writes a row; the worker claims it with a conditional update so it runs once, and on
failure retries it after 30 s, 2 min, 10 min and 30 min before marking it failed. Job kinds:

| Kind | Queued by | Does |
| --- | --- | --- |
| `refund_event` | cancelling an event | Refunds every paid order of the event in full |

## Email

Templates live in `src/mail/templates.js` and return a subject, a text body and an HTML body.
Everything a buyer receives goes into the outbox first and the worker hands it to the transport.
