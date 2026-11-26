# Operations

## Hosts

Production is one VM. systemd runs two units from `/srv/boxoffice/current` (files in `deploy/`):

- `boxoffice-web`: the API, behind the reverse proxy on port 3000.
- `boxoffice-worker`: holds, jobs and mail.

Shared state lives in `/srv/boxoffice/shared`: the database under `data/`, the `.env` file and
database backups under `backups/`.

Run exactly one worker. The web server can run as more than one process on the same host if it
ever needs to; they share the database file.

## Deploying

```sh
scripts/deploy.sh            # or: scripts/deploy.sh other-host
```

The script copies the commit to a new release directory, backs up the database, runs the
migrations, points `current` at the new release and restarts both units. It keeps the last five
releases and ten backups.

To roll back, point `current` at the previous release and restart both units. If the release ran a
migration, restore the backup taken before it first.

## Container

The image runs the web server by default and the worker with `node src/worker/index.js`. Mount a
volume at `/app/data` for the database and run `node bin/boxoffice.js migrate` once per release
before starting either.

## Backups

The deploy script takes one before every migration. A nightly cron also runs:

```sh
sqlite3 /srv/boxoffice/shared/data/boxoffice.db ".backup /srv/boxoffice/shared/backups/nightly.db"
```

## Day to day

| Task | Command |
| --- | --- |
| Add an organiser | `node bin/boxoffice.js tenant:create <slug> <name> --timezone <tz>` |
| Give them a key | `node bin/boxoffice.js key:create <slug> <label>` |
| Revoke a leaked key | `node bin/boxoffice.js key:revoke <prefix>` |
| A buyer lost their tickets email | `node bin/boxoffice.js tickets:resend <order-token>` |
| Mail provider was down | `node bin/boxoffice.js mail:retry` |
| Queue sizes | `node bin/boxoffice.js stats` |

## Logs

Both processes write JSON lines to stdout; journald keeps them. Useful messages:

| Message | Means |
| --- | --- |
| `payment.charge_failed` | The provider couldn't be reached during checkout. The buyer can retry |
| `job.failed` | A job threw. `outcome` says whether it will be retried |
| `mail.send_failed` | The mail transport refused a message |
| `worker.tick_failed` | A whole worker pass failed. Check the database and disk |

## Incidents

- **Payments down**: checkouts fail with `502` and holds run out as usual. Nothing to clean up.
- **Mail down**: messages stay in the outbox; run `mail:retry` once the provider is back.
- **Disk full**: SQLite starts failing writes. Free space, then check `stats` for stuck jobs.
