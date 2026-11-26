# 0005. Holds end in the worker, not when read

Date: 2026-01-20. Status: accepted.

## Context

A hold has an expiry time. We could treat a hold as over the moment its time passes, everywhere it
is read, or only once the worker has marked it expired. With the first, availability, checkout and
the worker each compare times on their own and can disagree for a moment: checkout could start a
charge on a hold that availability has already handed to someone else.

## Decision

- A hold counts as taking its seats while its status is `active`, whatever its expiry time.
- Only the worker (or `holds:expire`) moves a hold to `expired`, and never while its order is being
  charged.
- Checkout refuses a hold whose expiry time has passed, even if the worker hasn't reached it yet.

## Consequences

- Seats come back on sale up to `WORKER_INTERVAL_SECONDS` after a hold runs out.
- A hold that starts checkout just before its time is up keeps its seats until the charge finishes.
