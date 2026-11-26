# 0003. Email goes through an outbox

Date: 2025-12-02. Status: accepted.

## Context

Early versions sent the tickets email from the checkout request. When the mail provider was slow,
checkouts took 20 seconds; when it was down, the buyer saw an error after being charged, and some
paid again. When the database write failed after the send, buyers got tickets for orders that did
not exist.

## Decision

- Every email is written to the `outbox` table in the same transaction as the change that causes
  it (an order paid, a refund recorded, an event cancelled).
- Only the worker sends email. It takes pending rows in order, hands each to the transport, and
  marks it sent once the transport accepts it. A failed send stays in the outbox and is retried; after
  five failures it is marked `failed` and `mail:retry` puts it back.
- Request handlers never call the mail transport.

## Consequences

- Email goes out up to `WORKER_INTERVAL_SECONDS` after the change.
- An email is never sent for a change that was rolled back, and never lost for one that committed.
- Delivery is at least once: a crash between sending and marking sent repeats one email.
