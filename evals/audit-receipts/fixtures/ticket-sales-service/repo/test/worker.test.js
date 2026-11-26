import assert from 'node:assert/strict';
import { test } from 'node:test';
import { claimNextJob, enqueueJob, failJob } from '../src/jobs.js';
import { enqueueMail } from '../src/mail/outbox.js';
import { tick } from '../src/worker/index.js';
import { runDueJobs } from '../src/worker/run-jobs.js';
import { addOrganiser, buy, onSaleEvent, setup } from './helpers.js';

const message = (to) => ({ kind: 'test', to, subject: 'Hello', text: 'Hello', html: '<p>Hello</p>' });

test('a tick delivers queued mail and marks it sent', async () => {
  const { ctx, call } = setup();
  const { key } = addOrganiser(ctx);
  const { eventId, tierIds } = await onSaleEvent(call, key);
  await buy(call, eventId, tierIds[0]);

  const result = await tick(ctx);
  assert.deepEqual(result.mail, { attempted: 1, sent: 1 });
  assert.equal(ctx.mailer.sent.length, 1);
  assert.equal(ctx.mailer.sent[0].subject, 'Your tickets for Late Night Jazz');
  assert.equal(ctx.db.prepare("SELECT COUNT(*) AS n FROM outbox WHERE status = 'pending'").get().n, 0);
});

test('a tick expires holds past their time', async () => {
  const { ctx, call } = setup();
  const { key } = addOrganiser(ctx);
  const { eventId, tierIds } = await onSaleEvent(call, key);
  await call('POST', `/public/events/${eventId}/holds`, {
    body: { tierId: tierIds[0], quantity: 2, email: 'x@example.test', name: 'X' },
  });
  assert.equal((await tick(ctx)).expired, 0);
  ctx.clock.advanceMinutes(20);
  assert.equal((await tick(ctx)).expired, 1);
});

test('mail is delivered in the order it was queued', async () => {
  const { ctx } = setup();
  for (const to of ['1@example.test', '2@example.test', '3@example.test']) enqueueMail(ctx.db, message(to));
  await tick(ctx);
  assert.deepEqual(
    ctx.mailer.sent.map((sent) => sent.to),
    ['1@example.test', '2@example.test', '3@example.test'],
  );
});

test('a failing job is retried later, then given up on', async () => {
  const { ctx } = setup();
  const id = enqueueJob(ctx.db, 'no_such_kind', {}, ctx.clock.now());

  const first = await runDueJobs(ctx);
  assert.deepEqual(first, { done: 0, retried: 1, failed: 0 });
  const row = ctx.db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
  assert.equal(row.status, 'pending');
  assert.equal(row.run_after, '2026-05-01T10:00:30.000Z');
  assert.match(row.last_error, /no handler/);

  assert.deepEqual(await runDueJobs(ctx), { done: 0, retried: 0, failed: 0 });
  for (let i = 0; i < 4; i += 1) {
    ctx.clock.advanceMinutes(60);
    await runDueJobs(ctx);
  }
  assert.equal(ctx.db.prepare('SELECT status FROM jobs WHERE id = ?').get(id).status, 'failed');
});

test('a job is claimed by one runner only', () => {
  const { ctx } = setup();
  enqueueJob(ctx.db, 'refund_event', { eventId: 1 }, ctx.clock.now());
  const first = claimNextJob(ctx.db, ctx.clock.now());
  const second = claimNextJob(ctx.db, ctx.clock.now());
  assert.ok(first);
  assert.equal(second, null);
  assert.equal(failJob(ctx.db, first, new Error('boom'), ctx.clock.now()), 'retry');
});
