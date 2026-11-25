# Security

## Accounts and sessions

- Passwords are hashed with PBKDF2-SHA256, 240,000 iterations and a random 16-byte salt per password. Patients choose passwords of at least 10 characters.
- A sign-in with an unknown email takes as long as one with a wrong password, and both get the same answer, so the API doesn't reveal which emails have accounts.
- Every sign-in attempt is recorded in `login_attempts`. After five failed attempts for an email within 15 minutes, that email can't sign in for the next 15 minutes, even with the right password.
- Session tokens are 32 random bytes. The database holds only their SHA-256 hash. Sessions end after `session_hours` (12 by default) or at sign-out.
- `python -m clinicbook purge` deletes expired sessions and sign-in attempts older than 30 days. Run it daily.

## Roles

| Can | patient | staff | admin |
| --- | --- | --- | --- |
| Book, see, cancel and move their own bookings | yes | | |
| Book for any patient of the clinic, see and change the clinic's bookings | | yes | yes |
| Mark bookings completed or missed | | yes | yes |
| List and add patients | | yes | yes |
| Export bookings | | | yes |

Admin and staff accounts are created with the CLI. Patients register themselves.

## Tenants

A user belongs to one clinic and every request is limited to it ([ADR 0003](adr/0003-tenant-scoping.md)). Records of another clinic answer 404.

## Secrets

Provider keys come only from environment variables. The image contains no secrets and runs as an unprivileged user.

## Exports

The CSV export holds patient contact details, so only admins can download it. Text cells that start with `=`, `+`, `-`, `@`, a tab or a carriage return are prefixed with `'` so a spreadsheet shows them as text.
