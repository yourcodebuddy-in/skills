import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openDatabase } from '../src/db/database.js';
import { enqueueDailyDigests } from '../src/digest/digest.js';
import { addDays } from '../src/lib/time.js';
import { deliverPending, enqueueEmail } from '../src/mail/outbox.js';
import { START, memoryMailer, startApp, teamWithMember } from './helpers.js';

test('each member with recent changes gets one digest a day', async (t) => {
  const app = await startApp(t);
  const { owner, member, team } = await teamWithMember(app, 'viewer');
  await owner.post(`/teams/${team.id}/notes`, { title: 'Release notes', body: '' });
  await member.patch('/me', { digest: false });

  const now = addDays(START, 0.5);
  const first = enqueueDailyDigests(app.db, { now, publicUrl: app.config.publicUrl });
  const again = enqueueDailyDigests(app.db, { now, publicUrl: app.config.publicUrl });
  assert.equal(first, 1);
  assert.equal(again, 0);

  const rows = app.db.prepare('SELECT recipient, subject, body FROM outbox').all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].recipient, 'owner@example.com');
  assert.match(rows[0].subject, /1 note changed/);
  assert.match(rows[0].body, /Release notes/);
});

test('old changes are left out of the digest', async (t) => {
  const app = await startApp(t);
  const ada = await app.signUp('ada@example.com');
  const { body: team } = await ada.post('/teams', { name: 'Design' });
  await ada.post(`/teams/${team.id}/notes`, { title: 'Old', body: '' });

  const queued = enqueueDailyDigests(app.db, { now: addDays(START, 3), publicUrl: 'http://notes.test' });
  assert.equal(queued, 0);
});

test('the outbox sends pending mail and marks it sent', async () => {
  const db = openDatabase(':memory:');
  const mailer = memoryMailer();
  enqueueEmail(db, { to: 'a@example.com', subject: 'One', text: 'x' }, { kind: 'test', now: START });
  enqueueEmail(db, { to: 'b@example.com', subject: 'Two', text: 'y' }, { kind: 'test', now: START });

  const sent = await deliverPending(db, mailer, { now: START });
  assert.equal(sent, 2);
  assert.deepEqual(
    mailer.sent.map((message) => message.to),
    ['a@example.com', 'b@example.com'],
  );
  assert.equal(await deliverPending(db, mailer, { now: START }), 0);
  db.close();
});

test('a failed send is recorded against the message', async () => {
  const db = openDatabase(':memory:');
  enqueueEmail(db, { to: 'a@example.com', subject: 'One', text: 'x' }, { kind: 'test', now: START });
  const failing = {
    async send() {
      throw new Error('connection reset');
    },
  };

  await assert.rejects(deliverPending(db, failing, { now: START }), /connection reset/);
  const row = db.prepare('SELECT attempts, last_error, sent_at FROM outbox').get();
  assert.equal(row.attempts, 1);
  assert.equal(row.last_error, 'connection reset');
  assert.equal(row.sent_at, null);
  db.close();
});

test('the same dedupe key is only queued once', () => {
  const db = openDatabase(':memory:');
  const message = { to: 'a@example.com', subject: 'One', text: 'x' };
  assert.equal(enqueueEmail(db, message, { kind: 'test', dedupeKey: 'k1', now: START }), true);
  assert.equal(enqueueEmail(db, message, { kind: 'test', dedupeKey: 'k1', now: START }), false);
  db.close();
});
