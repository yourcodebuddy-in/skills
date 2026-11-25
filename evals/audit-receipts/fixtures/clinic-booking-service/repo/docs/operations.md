# Operations

## Deploying

The image built from `Dockerfile` runs one command per container. Run two containers from it on the same host, sharing a volume at `/data`:

```sh
docker run -d --name clinicbook-web -v clinicbook-data:/data -p 8080:8080 --env-file /etc/clinicbook.env clinicbook serve
docker run -d --name clinicbook-worker -v clinicbook-data:/data --env-file /etc/clinicbook.env clinicbook worker
```

`/etc/clinicbook.env` holds `CLINICBOOK_SMS_API_KEY`, `CLINICBOOK_PAYMENTS_API_KEY` and the provider URLs. The image sets `CLINICBOOK_DB=/data/clinicbook.sqlite3` and `CLINICBOOK_HOST=0.0.0.0`.

The `serve` container applies pending migrations before it starts (`deploy/entrypoint.sh`), so deploy the web container first. If a migration fails, the container exits and the previous schema is left as it was.

Run one worker container, never more.

## Commands

All commands are `python -m clinicbook <command>`; `--help` lists their options.

| Command | Does |
| --- | --- |
| `serve` | Run the API |
| `worker [--once]` | Run the worker, or one tick of it |
| `migrate [--to N]` | Apply pending migrations, or those up to number N |
| `create-clinic SLUG NAME ZONE [--currency USD]` | Add a clinic. Currency is USD or CAD |
| `create-user CLINIC EMAIL admin\|staff` | Add a staff account. The password comes from `CLINICBOOK_NEW_PASSWORD` or a prompt |
| `add-practitioner CLINIC NAME --price-cents N [--slot-minutes 30] [--specialty S]` | Add a practitioner |
| `add-hours CLINIC PRACTITIONER_ID WEEKDAY START END` | Add working hours; weekday 0 is Monday |
| `deactivate-practitioner CLINIC PRACTITIONER_ID` | Stop new bookings with a practitioner; existing bookings stay |
| `import-patients CLINIC FILE.csv` | Import patients; columns `name`, `email` and optional `phone`. Emails the clinic already has are skipped. Exits 1 if any row was rejected |
| `outbox-failed [--clinic SLUG]` | List messages that could not be delivered |
| `purge` | Delete expired sessions and sign-in attempts older than 30 days |
| `backup DEST` | Copy the live database to a new file, safely while it's in use |

## Daily routine

- `backup /data/backups/clinicbook-$(date +%F).sqlite3` each night, kept for 30 days.
- `purge` each night.
- Front desks check `outbox-failed --clinic <slug>` each morning and phone the patients listed, since failed messages aren't retried ([ADR 0006](adr/0006-reminders-at-most-once.md)).

## Logs

Both processes log one line per event to stderr, at `log_level`. The worker logs a summary for any tick that did something, and the full traceback for a step that failed; a failed step runs again on the next tick.
