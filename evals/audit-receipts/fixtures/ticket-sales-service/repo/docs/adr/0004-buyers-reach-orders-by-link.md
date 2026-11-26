# 0004. Buyers reach their holds and orders by link, without accounts

Date: 2025-12-09. Status: accepted.

## Context

Most buyers come once a year for one show. Asking them to make an account loses sales, and we
would then have passwords to look after. Buyers still need to see their order and tickets again,
and to come back to a hold while they find their card.

## Decision

- A hold and an order each get a token of 128 random bits from `crypto.randomBytes`, hex encoded.
- The token is the only way to reach them: `GET /holds/:token`, `POST /holds/:token/checkout`,
  `GET /orders/:token`. Hold and order ids never appear in buyer URLs or responses.
- The order link goes in the tickets email. Anyone with the link can see that order's tickets,
  as with a printed ticket or a receipt link from a card provider.
- Buyer routes take no other credential and do no rate limiting on token lookups; 2^128 tokens
  can't be guessed.

## Consequences

- Forwarding the email forwards the tickets. That is how buyers already share tickets with friends.
- A buyer who loses the email asks the organiser, who can resend it (`tickets:resend`).
