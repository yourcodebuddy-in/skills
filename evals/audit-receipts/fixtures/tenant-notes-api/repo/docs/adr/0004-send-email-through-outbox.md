# 4. All email goes through an outbox

Date: 2026-02-16
Status: accepted

## Context

The first version sent email straight from request handlers. When the provider was slow, sign-ups and invites hung; when it was down, they failed after the change had already been saved, and the email was gone for good.

## Decision

Request handlers and jobs never call the mailer. They insert a row into the `outbox` table, in the same transaction as the change that caused it when there is one. The outbox worker in the server process is the only code that calls `mailer.send`. It runs every 30 seconds, sends the oldest pending rows first, and retries a failed row on later runs, up to 5 attempts.

Rows can carry a `dedupe_key`; inserting a second row with the same key does nothing. The daily digest uses this so the job can be rerun safely.

## Consequences

- A slow or failing provider never slows or fails a request.
- Email is delayed by up to 30 seconds.
- Delivery problems show up in one place: rows with `last_error` set.
