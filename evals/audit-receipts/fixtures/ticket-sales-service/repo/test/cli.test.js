import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../bin/boxoffice.js', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'boxoffice-cli-'));
const env = { ...process.env, DATABASE_PATH: join(dir, 'cli.db'), NODE_ENV: 'test' };
after(() => rmSync(dir, { recursive: true, force: true }));

const cli = (...args) => spawnSync(process.execPath, ['--no-warnings', CLI, ...args], { env, encoding: 'utf8' });

test('migrate applies every migration once', () => {
  const first = cli('migrate');
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /applied 001_initial\.sql/);
  assert.equal(cli('migrate').stdout.trim(), 'up to date');
  assert.equal(cli('migrate', '--status').stdout.trim(), 'up to date');
});

test('tenants and keys are managed from the command line', () => {
  cli('migrate');
  const created = cli('tenant:create', 'old-chapel', 'The', 'Old', 'Chapel', '--timezone', 'Europe/Dublin');
  assert.equal(created.status, 0, created.stderr);
  assert.match(cli('tenant:list').stdout, /old-chapel\tEurope\/Dublin\tThe Old Chapel/);

  const key = cli('key:create', 'old-chapel', 'box office laptop').stdout.trim();
  assert.match(key, /^bo_[0-9a-f]{8}_[A-Za-z0-9_-]{32}$/);
  const prefix = key.split('_')[1];
  assert.equal(cli('key:revoke', prefix).stdout.trim(), `revoked ${prefix}`);
  assert.match(cli('key:list', 'old-chapel').stdout, /revoked/);
});

test('a duplicate tenant slug is refused', () => {
  cli('migrate');
  cli('tenant:create', 'twin', 'Twin');
  const again = cli('tenant:create', 'twin', 'Twin');
  assert.equal(again.status, 1);
  assert.match(again.stderr, /slug_taken/);
});

test('unknown commands print usage', () => {
  const res = cli('frobnicate');
  assert.equal(res.status, 2);
  assert.match(res.stderr, /Usage: boxoffice/);
});
