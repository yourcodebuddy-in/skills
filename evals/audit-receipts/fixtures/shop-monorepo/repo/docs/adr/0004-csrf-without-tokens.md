# 4. CSRF protection without tokens

Date: 2026-04-14
Status: accepted

## Context

The API authenticates browsers with a session cookie, so another site could try to make a signed-in
shopper's or staff member's browser send a request that changes something. The usual defence is a
CSRF token in every form, which means rendering pages on the server or adding a token endpoint and
remembering to send it from every script.

The storefront and admin are static pages that talk to the API with `fetch`, on the same origin.

## Decision

We don't use CSRF tokens. Instead:

1. The session cookie is `HttpOnly; SameSite=Strict; Path=/` (and `Secure` in production), so
   browsers don't attach it to requests started by another site.
2. Every request other than `GET` must have `Content-Type: application/json`, and the API answers
   `415` otherwise. A cross-site HTML form can only send `application/x-www-form-urlencoded`,
   `multipart/form-data` or `text/plain`; sending JSON cross-site needs a CORS preflight.
3. The API sends no CORS headers at all, so such a preflight always fails.
4. `GET` requests never change anything.

## Consequences

- Each layer stops cross-site requests on its own; a browser that ignored `SameSite` still could
  not send JSON across sites.
- The payment webhook is not a browser request; it's authenticated by its signature, and it sends
  JSON like everything else.
- If the API ever needs to be called from another origin, this record must be revisited before any
  CORS header is added.
