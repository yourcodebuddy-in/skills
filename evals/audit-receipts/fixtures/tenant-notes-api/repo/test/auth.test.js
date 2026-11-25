import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addDays } from '../src/lib/time.js';
import { PASSWORD, startApp } from './helpers.js';

test('registering returns a session and sets an HttpOnly cookie', async (t) => {
  const app = await startApp(t);
  const res = await app.client().post('/auth/register', {
    email: ' Ada@Example.com ',
    name: 'Ada',
    password: PASSWORD,
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.user.email, 'ada@example.com');
  assert.match(res.body.token, /^[\w-]{43}$/);
  const cookie = res.headers.get('set-cookie');
  assert.match(cookie, /^sid=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
});

test('an email can only be registered once', async (t) => {
  const app = await startApp(t);
  await app.signUp('ada@example.com');
  const res = await app.client().post('/auth/register', {
    email: 'ADA@example.com',
    name: 'Ada again',
    password: PASSWORD,
  });
  assert.equal(res.status, 409);
});

test('short passwords are refused', async (t) => {
  const app = await startApp(t);
  const res = await app.client().post('/auth/register', {
    email: 'ada@example.com',
    name: 'Ada',
    password: 'short',
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /password/);
});

test('login works with the right password and fails with the wrong one', async (t) => {
  const app = await startApp(t);
  await app.signUp('ada@example.com');

  const good = await app.client().post('/auth/login', { email: 'ada@example.com', password: PASSWORD });
  assert.equal(good.status, 200);
  assert.ok(good.body.token);

  const bad = await app.client().post('/auth/login', { email: 'ada@example.com', password: 'nope nope nope' });
  assert.equal(bad.status, 401);

  const unknown = await app.client().post('/auth/login', { email: 'who@example.com', password: PASSWORD });
  assert.equal(unknown.status, 401);
  assert.equal(unknown.body.error, bad.body.error);
});

test('/me needs a session', async (t) => {
  const app = await startApp(t);
  const anonymous = await app.client().get('/me');
  assert.equal(anonymous.status, 401);

  const ada = await app.signUp('ada@example.com', 'Ada');
  const me = await ada.get('/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.user.name, 'Ada');
  assert.deepEqual(me.body.teams, []);
});

test('sessions stop working after they expire', async (t) => {
  const app = await startApp(t);
  const ada = await app.signUp('ada@example.com');
  assert.equal((await ada.get('/me')).status, 200);

  app.clock.now = addDays(app.clock.now, app.config.sessionDays + 1);
  assert.equal((await ada.get('/me')).status, 401);
});

test('logout ends the session', async (t) => {
  const app = await startApp(t);
  const ada = await app.signUp('ada@example.com');
  const res = await ada.post('/auth/logout');
  assert.equal(res.status, 204);
  assert.match(res.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
  assert.equal((await ada.get('/me')).status, 401);
});

test('the digest preference can be turned off', async (t) => {
  const app = await startApp(t);
  const ada = await app.signUp('ada@example.com');
  const res = await ada.patch('/me', { digest: false });
  assert.equal(res.status, 200);
  const row = app.db.prepare('SELECT digest_opt_in FROM users WHERE email = ?').get('ada@example.com');
  assert.equal(row.digest_opt_in, 0);
});
