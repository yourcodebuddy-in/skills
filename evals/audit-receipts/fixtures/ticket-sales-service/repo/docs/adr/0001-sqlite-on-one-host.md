# 0001. SQLite on one host, with one worker

Date: 2025-11-04. Status: accepted.

## Context

Our venues sell a few hundred to a few thousand tickets per event, and the busiest on-sale moment
we have seen is about 40 holds a minute. We are two developers with no operations team. A managed
Postgres, a queue service and a second host would each be one more thing to pay for and keep up.

## Decision

- The service runs on one host with one SQLite database file in WAL mode, shared by the web server
  and the worker.
- Every multi-statement write uses `BEGIN IMMEDIATE`, so the write lock is held from the first read.
  With one writer at a time, read-then-write checks such as seat availability are safe.
- Background work (expiring holds, jobs, email) runs in one worker process. We run exactly one.
- Backups are SQLite `.backup` copies, taken before each migration and nightly.

## Consequences

- No horizontal scaling beyond one host. At our volume that is years away.
- The disk is a single point of failure; the nightly backup bounds the loss to a day, and the
  provider's records let us rebuild payments for that day.
- Moving to Postgres later means rewriting `src/db.js` and the few SQLite-specific statements.
