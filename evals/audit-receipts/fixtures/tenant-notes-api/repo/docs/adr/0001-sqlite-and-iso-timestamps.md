# 1. SQLite through node:sqlite, timestamps as ISO strings

Date: 2026-01-12
Status: accepted

## Context

We expect tens of teams, not thousands, and want deploys to be one process and one file. Every extra dependency is something to patch.

## Decision

- Store everything in one SQLite file, opened with the built-in `node:sqlite` module. No ORM and no query builder; queries are written by hand with `?` parameters.
- Run a single server process. SQLite handles our write volume, and the outbox worker relies on being the only sender.
- Store every timestamp as an ISO-8601 UTC string from `Date.prototype.toISOString()`. These sort correctly as text, so SQL compares them as text against another ISO string: `expires_at > ?` is bound to `now.toISOString()`.

## Consequences

- No horizontal scaling. If we ever need it, the move is to Postgres, not to several SQLite processes.
- Backups are a copy of the file taken with `VACUUM INTO`.
- Code that needs epoch milliseconds converts at the edge; nothing stores numbers for time.
