# 1. One SQLite file on one host

Date: 2025-09-08. Status: accepted.

## Context

The group has six clinics and about forty staff. Peak load is the front desks at opening time and patients booking in the evening: a few requests a second. Nobody on the team runs a database server today.

## Decision

All data lives in one SQLite file in WAL mode, on the host that runs both containers. The API and the worker open their own connections to it.

- Connections run in autocommit mode. Changes that must happen together, and any read that a following write depends on, run in `db.transaction(conn, immediate=True)`, which takes the write lock at `BEGIN`, so two writers can't interleave.
- `busy_timeout` is 10 seconds, so a writer waits for the lock rather than failing.
- Backups use SQLite's online backup (`python -m clinicbook backup`).

## Consequences

- One host. Moving to two hosts means moving to a database server first.
- Writes are serialised. At our load that costs nothing measurable.
- There is one worker process, which keeps the background jobs simple.
