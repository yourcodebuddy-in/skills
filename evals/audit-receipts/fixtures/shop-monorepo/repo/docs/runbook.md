# Runbook

## Where it runs

One small VM. The API runs as a systemd service under the `shop` user, behind Caddy for TLS.
The database is `/var/lib/shop/shop.db`.

```ini
# /etc/systemd/system/shop.service (excerpt)
[Service]
User=shop
WorkingDirectory=/opt/shop
EnvironmentFile=/etc/shop/env
ExecStart=/usr/bin/node apps/api/src/server.js
Restart=on-failure
```

`/etc/shop/env` holds `NODE_ENV=production`, `DATABASE_FILE` and `PAYMENT_WEBHOOK_SECRET`. It is
readable by root and `shop` only.

## Deploying

1. Merge to `main` once CI is green.
2. On the VM: `cd /opt/shop && git pull && sudo systemctl restart shop`.
3. Migrations run on start. Check the log for `server.started`.

## Backups

A cron job copies the database every night at 02:00 UTC with `sqlite3 shop.db ".backup …"` and
uploads it to the `kettle-backups` bucket. The analytics contractor has read access to that bucket
for the weekly sales dashboards. Backups are kept for 30 days.

## Rotating the webhook secret

1. Create the new secret in the provider's dashboard; the provider signs with both while the old
   one is still active.
2. Put the new secret in `/etc/shop/env` and restart the service.
3. Retire the old secret in the dashboard.

## Common problems

- **An order is stuck awaiting payment.** Check the log for `webhook.rejected`. A wrong
  `PAYMENT_WEBHOOK_SECRET` rejects every event; a clock that has drifted more than five minutes
  rejects them as stale.
- **Emails aren't going out.** Rows in `outbox` with `attempts = 5` and no `sent_at` have failed
  five times; fix the cause, then set their `attempts` back to 0.
