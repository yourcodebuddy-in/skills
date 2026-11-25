# 3. Store session and share tokens as plain SHA-256 hashes

Date: 2026-02-02
Status: accepted

## Context

Session tokens and share-link tokens are bearer secrets. If the database leaks, stored tokens must not be usable. The usual advice for secrets is a slow, salted hash such as scrypt or bcrypt, which is what we use for passwords.

## Decision

Tokens are 32 bytes from `crypto.randomBytes`, sent to the client as base64url. We store only `sha256(token)` as hex, with no salt and a single round, and look tokens up by that hash.

A slow, salted hash protects inputs that people choose and that can be guessed. A token has 256 bits of entropy, so there is nothing to guess and no precomputed table can cover it; salt and cost add nothing. A slow hash would also put tens of milliseconds of CPU on every authenticated request, and a salted one would stop us looking a token up by its hash.

## Consequences

- A database leak gives no usable tokens.
- The raw token appears once: in the login response and cookie, or in the share URL when the link is made. We can't show a share URL again; people make a new link instead.
- Passwords keep using scrypt. This decision is only for random tokens we generate.
