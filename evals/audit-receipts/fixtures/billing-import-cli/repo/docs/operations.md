# Operations

## Where it runs

Production runs on `billing.internal` as a Docker image, from three systemd timers:

| Timer | Schedule | Runs |
| --- | --- | --- |
| `usagebill-import` | 02:00 daily | `usagebill import` for each new file in `inbox/<account>/` |
| `usagebill-send` | 06:00 daily | `usagebill send` |
| `usagebill-backup` | 03:00 daily | copies `/data/usagebill.db` to the backup bucket |

The database lives in the `usagebill-data` volume at `/data/usagebill.db`.

## Deploying

```sh
REGISTRY=registry.internal/billing USAGEBILL_WEBHOOK_TOKEN=... deploy/deploy.sh staging
```

The script builds and pushes the image tagged with the commit, runs `usagebill migrate` against the environment's database, then points the timers at the new image. Run it from a clean checkout of `main`.

Check staging with a dry-run import of a recent file before deploying to production:

```sh
ssh deploy@billing-staging.internal \
  "docker run --rm -v usagebill-data:/data -v /srv/inbox:/inbox \$(cat /etc/usagebill/image) import --dry-run --account northwind /inbox/northwind/done/latest.csv"
```

## Month end

1. On the 1st, run `usagebill invoice generate --period <last month>`.
2. Review drafts with `usagebill invoice list --status draft` and `usagebill preview`.
3. Late files can still arrive until the 3rd; rerun `generate` after each.
4. On the 3rd, run `usagebill invoice finalize --period <last month>` and `usagebill export --period <last month> --out /data/exports/<last month>`.
5. The 06:00 `send` run on the 4th posts the month to accounting.

## When something goes wrong

- **A file was refused.** The import log lists the problems. The customer fixes the file and uploads it again; nothing from the refused file is in the database.
- **`send` stopped with an HTTP 4xx.** The accounting system refused an invoice. Invoices before it are marked sent; it and the rest are still finalized and will go on the next run once the cause is fixed.
- **Restoring a backup.** Stop the timers, copy the backup over `/data/usagebill.db`, run `usagebill migrate`, restart the timers.
