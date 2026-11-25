# 4. Patient messages go through the outbox

Date: 2025-10-02. Status: accepted.

## Context

Patients get a text when a booking is cancelled, moved or charged, and a reminder before it. The SMS provider is sometimes slow and occasionally down.

## Decision

- Code that changes a booking writes the message for it to the `outbox` table, in the same transaction as the change.
- Only the worker sends messages. Request handlers never call the SMS provider.

## Consequences

- A slow or failing provider can't slow down or fail a patient's request, and a request that fails or rolls back never sends a message about a change that didn't happen.
- Messages leave up to one worker interval (a minute) after the change.
- Every message is in one table, so `outbox-failed` shows everything that didn't arrive.
