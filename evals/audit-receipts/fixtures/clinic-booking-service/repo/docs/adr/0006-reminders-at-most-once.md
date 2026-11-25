# 6. Patient messages are sent at most once

Date: 2025-11-14. Status: accepted.

## Context

The SMS provider sometimes accepts a message and then times out before answering, and the worker can stop between handing a message to the provider and recording that it did. Retrying in either case sends the message twice. In the pilot, duplicate reminders, each warning about the no-show fee, were the most common complaint to front desks, and two patients turned up twice. A missing reminder, by contrast, costs a phone call, and the front desks already call patients who have no phone number on file.

## Decision

- The worker marks each due message `sent` before handing it to the provider, claiming it with a conditional update so no two workers get the same row.
- If the provider refuses the message, the worker marks it `failed` with the provider's error. Failed messages are never retried.
- Front desks check `python -m clinicbook outbox-failed` each morning and phone the patients listed.

## Consequences

- A patient never gets the same message twice.
- A crash between claiming and sending loses that message silently; it stays `sent`. We accept that: it needs a crash at one moment, and the cost is a reminder not received.
