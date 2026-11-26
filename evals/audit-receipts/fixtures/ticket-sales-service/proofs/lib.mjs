// Shared helpers for the proofs. Each proof runs from the root of a copy of repo/ and writes only
// to temp directories it creates.
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const ROOT = process.cwd();

export const load = (relative, root = ROOT) => import(pathToFileURL(join(root, relative)).href);

const temps = [];
process.on('exit', () => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

export function tempDir(prefix = 'tss-proof-') {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
}

// A copy of the project without .git, for proofs that patch code.
export function copyRepo() {
  const dir = join(tempDir(), 'repo');
  cpSync(ROOT, dir, { recursive: true, filter: (source) => !source.split(/[\\/]/).includes('.git') });
  return dir;
}

export function fakeClock(start = '2026-05-01T10:00:00.000Z') {
  let current = new Date(start);
  return {
    now: () => new Date(current),
    advanceMinutes(minutes) {
      current = new Date(current.getTime() + minutes * 60_000);
    },
  };
}

export function fakeGateway({ delayMs = 0 } = {}) {
  const gateway = {
    charges: [],
    refunds: [],
    async charge(request) {
      if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
      const id = `ch_${gateway.charges.length + 1}`;
      gateway.charges.push({ id, ...request });
      return { id };
    },
    async refund(request) {
      const id = `re_${gateway.refunds.length + 1}`;
      gateway.refunds.push({ id, ...request });
      return { id };
    },
  };
  return gateway;
}

export function fakeMailer({ delayMs = 0 } = {}) {
  const mailer = {
    sent: [],
    async send(message) {
      if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
      mailer.sent.push(message);
    },
  };
  return mailer;
}

const silent = { debug() {}, info() {}, warn() {}, error() {}, child: () => silent };

// Builds a context and app from the project's own modules, with fakes for the outside world.
export async function makeApp({ root = ROOT, dbPath = ':memory:', env = {}, gateway, mailer, clock, migrate = true } = {}) {
  const { loadConfig } = await load('src/config.js', root);
  const { openDatabase } = await load('src/db.js', root);
  const migrations = await load('src/migrate.js', root);
  const { createApp } = await load('src/app.js', root);
  const config = loadConfig({ PAYMENTS_WEBHOOK_SECRET: 'whsec_proof', ...env });
  const db = openDatabase(dbPath);
  if (migrate) migrations.migrate(db);
  const ctx = {
    config,
    db,
    log: silent,
    clock: clock ?? fakeClock(),
    gateway: gateway ?? fakeGateway(),
    mailer: mailer ?? fakeMailer(),
  };
  const app = createApp(ctx);
  const call = async (method, url, { body, key, headers = {} } = {}) => {
    const response = await app.handle({
      method,
      url,
      headers: { ...(key ? { authorization: `Bearer ${key}` } : {}), ...headers },
      body: body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body),
    });
    const isJson = response.headers['content-type']?.startsWith('application/json');
    return { ...response, json: isJson && response.body ? JSON.parse(response.body) : undefined };
  };
  return { ctx, app, call };
}

export async function addOrganiser(ctx, slug, root = ROOT) {
  const { createTenant, createApiKey } = await load('src/services/tenants.js', root);
  const tenant = createTenant(ctx.db, { name: slug, slug, timezone: 'Europe/London' }, ctx.clock.now());
  const { key } = createApiKey(ctx.db, tenant.id, 'proof', ctx.clock.now());
  return { tenant, key };
}

export async function onSaleEvent(call, key, tiers = [{ name: 'Standing', priceCents: 2500, capacity: 100 }]) {
  const created = await call('POST', '/events', {
    key,
    body: { title: 'Proof Night', venue: 'Hall', startsAt: '2026-06-12T19:30:00Z', tiers },
  });
  if (created.status !== 201) throw new Error(`create: ${created.body}`);
  const { id, tiers: made } = created.json.event;
  const published = await call('POST', `/events/${id}/publish`, { key });
  if (published.status !== 200) throw new Error(`publish: ${published.body}`);
  return { eventId: id, tierIds: made.map((tier) => tier.id) };
}

export async function hold(call, eventId, tierId, { quantity = 2, email = 'buyer@example.test', name = 'Buyer' } = {}) {
  const res = await call('POST', `/public/events/${eventId}/holds`, { body: { tierId, quantity, email, name } });
  if (res.status !== 201) throw new Error(`hold: ${res.body}`);
  return res.json.hold.token;
}

export async function buy(call, eventId, tierId, options) {
  const token = await hold(call, eventId, tierId, options);
  const res = await call('POST', `/holds/${token}/checkout`, { body: { paymentToken: 'tok_visa' } });
  if (res.status !== 201) throw new Error(`checkout: ${res.body}`);
  return res.json.order;
}

export function check(condition, message) {
  if (!condition) {
    console.error(`NOT PROVEN: ${message}`);
    process.exit(1);
  }
  console.log(`ok: ${message}`);
}
