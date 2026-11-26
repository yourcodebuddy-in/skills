import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authenticate } from '../src/auth.js';
import { HttpError } from '../src/http/errors.js';
import { createApiKey, revokeApiKey } from '../src/services/tenants.js';
import { addOrganiser, testContext } from './helpers.js';

const header = (key) => ({ authorization: `Bearer ${key}` });

test('a valid key resolves to its tenant and records its use', () => {
  const ctx = testContext();
  const { tenant, key } = addOrganiser(ctx);
  assert.equal(authenticate(ctx.db, header(key), ctx.clock.now()).id, tenant.id);
  const row = ctx.db.prepare('SELECT last_used_at FROM api_keys WHERE tenant_id = ?').get(tenant.id);
  assert.equal(row.last_used_at, '2026-05-01T10:00:00.000Z');
});

test('only the hash of the secret is stored', () => {
  const ctx = testContext();
  const { key } = addOrganiser(ctx);
  const secret = key.split('_').slice(2).join('_');
  const stored = JSON.stringify(ctx.db.prepare('SELECT * FROM api_keys').all());
  assert.ok(!stored.includes(secret));
});

test('wrong, malformed and revoked keys are refused', () => {
  const ctx = testContext();
  const { tenant, key } = addOrganiser(ctx);
  const [, prefix] = key.split('_');
  const refused = (headers) => assert.throws(() => authenticate(ctx.db, headers), (error) => error instanceof HttpError && error.status === 401);

  refused({});
  refused({ authorization: key });
  refused({ authorization: `Basic ${key}` });
  refused(header(`bo_${prefix}_${'x'.repeat(32)}`));
  refused(header(`${key}extra!`));

  const other = createApiKey(ctx.db, tenant.id, 'second');
  assert.equal(revokeApiKey(ctx.db, prefix), true);
  refused(header(key));
  assert.equal(authenticate(ctx.db, header(other.key)).id, tenant.id);
});
