#!/usr/bin/env node
// Command line for migrations and maintenance. Reads the same environment as the server.
import { parseArgs } from 'node:util';
import { loadConfig } from '../src/config.js';
import { openDatabase } from '../src/db.js';
import { jobCounts } from '../src/jobs.js';
import { systemClock } from '../src/lib/time.js';
import { outboxCounts, retryFailedMail } from '../src/mail/outbox.js';
import { migrate, pendingMigrations } from '../src/migrate.js';
import { expireHolds } from '../src/services/holds.js';
import { resendTickets } from '../src/services/orders.js';
import {
  createApiKey,
  createTenant,
  getTenantBySlug,
  listApiKeys,
  listTenants,
  revokeApiKey,
} from '../src/services/tenants.js';

const USAGE = `Usage: boxoffice <command> [options]

Commands:
  migrate [--status]                     Apply pending migrations, or list them with --status
  tenant:create <slug> <name> [--timezone <tz>]
                                         Add an organiser (time zone defaults to UTC)
  tenant:list                            List organisers
  key:create <tenant-slug> [label]       Create an API key and print it once
  key:list <tenant-slug>                 List an organiser's keys
  key:revoke <prefix>                    Revoke a key by its prefix
  holds:expire                           Release expired holds now
  tickets:resend <order-token>           Queue the tickets email again
  mail:retry                             Queue failed emails again
  stats                                  Outbox and job counts
`;

const print = (value) => process.stdout.write(`${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`);

const commands = {
  migrate(db, args) {
    if (args.values.status) {
      const pending = pendingMigrations(db);
      print(pending.length ? pending.map((migration) => `pending ${migration.name}`).join('\n') : 'up to date');
      return;
    }
    const ran = migrate(db);
    print(ran.length ? ran.map((name) => `applied ${name}`).join('\n') : 'up to date');
  },

  'tenant:create'(db, args) {
    const [slug, ...nameParts] = args.positionals;
    if (!slug || nameParts.length === 0) throw new UsageError('tenant:create needs a slug and a name');
    const tenant = createTenant(db, { slug, name: nameParts.join(' '), timezone: args.values.timezone ?? 'UTC' });
    print(`created tenant ${tenant.slug} (${tenant.id})`);
  },

  'tenant:list'(db) {
    for (const tenant of listTenants(db)) print(`${tenant.id}\t${tenant.slug}\t${tenant.timezone}\t${tenant.name}`);
  },

  'key:create'(db, args) {
    const [slug, ...labelParts] = args.positionals;
    if (!slug) throw new UsageError('key:create needs a tenant slug');
    const tenant = getTenantBySlug(db, slug);
    const { key } = createApiKey(db, tenant.id, labelParts.join(' '));
    print(key);
  },

  'key:list'(db, args) {
    const [slug] = args.positionals;
    if (!slug) throw new UsageError('key:list needs a tenant slug');
    for (const key of listApiKeys(db, getTenantBySlug(db, slug).id)) {
      print(`${key.prefix}\t${key.revoked_at ? 'revoked' : 'active'}\t${key.last_used_at ?? 'never used'}\t${key.label}`);
    }
  },

  'key:revoke'(db, args) {
    const [prefix] = args.positionals;
    if (!prefix) throw new UsageError('key:revoke needs a key prefix');
    print(revokeApiKey(db, prefix) ? `revoked ${prefix}` : `no active key ${prefix}`);
  },

  'holds:expire'(db) {
    print(`expired ${expireHolds(db, systemClock.now())} holds`);
  },

  'tickets:resend'(db, args, config) {
    const [token] = args.positionals;
    if (!token) throw new UsageError('tickets:resend needs an order token');
    const id = resendTickets({ db, config, clock: systemClock }, token);
    print(`queued message ${id}`);
  },

  'mail:retry'(db) {
    print(`queued ${retryFailedMail(db)} messages again`);
  },

  stats(db) {
    print({ outbox: outboxCounts(db), jobs: jobCounts(db) });
  },
};

class UsageError extends Error {}

function run(argv, env = process.env) {
  const [command, ...rest] = argv;
  if (!command || command === 'help' || command === '--help') {
    print(USAGE);
    return 0;
  }
  const handler = commands[command];
  if (!handler) {
    process.stderr.write(`Unknown command "${command}"\n\n${USAGE}`);
    return 2;
  }
  const args = parseArgs({
    args: rest,
    allowPositionals: true,
    options: { status: { type: 'boolean' }, timezone: { type: 'string' } },
  });
  const config = loadConfig(env);
  const db = openDatabase(config.databasePath);
  try {
    handler(db, args, config);
    return 0;
  } catch (error) {
    process.stderr.write(`${error.message}${error.details ? ` ${JSON.stringify(error.details)}` : ''}\n`);
    return error instanceof UsageError ? 2 : 1;
  } finally {
    db.close();
  }
}

process.exitCode = run(process.argv.slice(2));
