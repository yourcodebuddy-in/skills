# 5. Session tokens hashed at rest

Date: 2026-05-20
Status: accepted

## Context

Sessions are rows in the `sessions` table, looked up on every request so that signing out takes
effect at once. A copy of the database leaves the server every night: the backup goes to the
storage bucket the analytics contractor reads (see the [runbook](../runbook.md)). Anyone with that
copy shouldn't be able to sign in as a customer or as staff.

## Decision

- The cookie carries a random 32-byte token.
- The `sessions.id` column stores the SHA-256 of that token, never the token itself. Looking a
  session up hashes the cookie value first.
- Passwords are stored as salted scrypt hashes.

## Consequences

- A leaked backup holds no live credentials: not passwords, not sessions.
- A session can't be recovered from the database, only revoked by deleting its row.
