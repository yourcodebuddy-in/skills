# 0003 Idempotent webhook posts

- Status: Accepted
- Date: 2025-09-18

## Context

`usagebill send` posts each finalized invoice to the accounting system. Posts can time out after the accounting system has already recorded the invoice; when we simply retried, finance found the same invoice booked twice.

The accounting system supports an `Idempotency-Key` header. It stores each key for 24 hours and answers a repeat of a key with the response to the first request, without booking anything again.

## Decision

- Every post of an invoice carries `Idempotency-Key` set to the invoice number. Invoice numbers are unique and never reused.
- Retries of the same invoice send the same key, so a retry after a timeout can't book the invoice twice.
- We retry network errors, `429` and `5xx`, with a short backoff, and stop on any other `4xx`.

## Consequences

- An invoice resent after more than 24 hours is booked again; resending a sent invoice needs a manual check with finance.
