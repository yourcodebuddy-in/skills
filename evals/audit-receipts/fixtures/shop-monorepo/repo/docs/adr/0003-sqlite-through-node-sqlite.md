# 3. SQLite through node:sqlite

Date: 2026-03-09
Status: accepted

## Context

Order volume is a few hundred a day at peak. We want a database that needs no server, backs up as
one file, and can't be misconfigured in production.

## Decision

- SQLite in WAL mode, opened through `node:sqlite`'s synchronous `DatabaseSync`.
- One API process owns the database file. We scale up the machine, not the number of processes.
- Writes that must happen together run inside `transaction()` from `packages/db/src/database.js`,
  which uses `BEGIN IMMEDIATE` and refuses asynchronous work. Because the driver is synchronous,
  nothing else in the process runs between a transaction's statements.
- Rules that depend on the current value of a row (stock, coupon uses) are written as conditional
  updates (`… WHERE stock >= ?`) and checked by the number of rows changed, not read first and
  written after.

## Consequences

- No connection pool, no network hop, no ORM.
- Calls to the payment provider are asynchronous, so they never run inside a transaction: we write
  before the call or after it.
- If we ever need a second API process, conditional updates keep stock and coupons right, but
  this record needs revisiting.
