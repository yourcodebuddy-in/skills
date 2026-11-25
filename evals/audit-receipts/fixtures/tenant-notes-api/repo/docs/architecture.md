# Architecture

One Node process serves the API and delivers email. One SQLite file holds everything.

## Layout

```text
src/
  server.js        starts the HTTP server and the outbox worker
  app.js           routing, sessions, error handling, request log
  config.js        reads the environment once at start
  constants.js     limits shared across features
  db/              opening the database, migrations, transactions
  http/            router, body parsing, cookies, responses, errors
  auth/            passwords, sessions, accounts, role checks
  teams/           teams, members, roles
  notes/           notes and tags
  shares/          share links and the public page
  export/          CSV export
  mail/            mailer transports, templates, outbox
  digest/          building the daily digest
  lib/             small helpers with no app knowledge
  routes/          one file per feature, wiring HTTP to the modules above
scripts/
  queue-digests.js queues the daily digest; run from cron
```

Routes do the HTTP work: read the session, check the role, parse the body, shape the response. The feature modules take a database handle and plain values and never see a request.

## A request

1. `app.js` matches the path. Unknown paths are `404`, known paths with the wrong method are `405`.
2. It looks up the session from the bearer token or the `sid` cookie. Endpoints that need a user call `requireUser`.
3. Team endpoints call `requireRole(db, teamId, userId, minimum)`, which returns `404` for non-members and `403` for members without the role.
4. The handler returns `{ status, headers, body }` and `app.js` writes it. An `HttpError` becomes its status and message; anything else is logged and becomes a `500` with a generic message.
5. Every request is logged as method, route pattern, status and duration. Paths are logged by pattern, not as sent, so share tokens never reach the log.

## Background work

- **Outbox worker.** Started by `server.js`. Every 30 seconds it sends up to 50 pending emails, oldest first. A message is retried on later runs until it has failed 5 times.
- **Daily digest.** `scripts/queue-digests.js` writes one outbox row per person who has the digest on and had notes change in their teams in the last 24 hours. The row's `dedupe_key` is `digest:<user>:<UTC date>`, so running the script twice in a day queues nothing new.

## Data

Timestamps are ISO-8601 UTC strings ([ADR 0001](adr/0001-sqlite-and-iso-timestamps.md)). Note ids are integers; team and user ids are random UUIDs. Foreign keys are on, and child rows (tags, share links, memberships, sessions) are removed with their parent.
