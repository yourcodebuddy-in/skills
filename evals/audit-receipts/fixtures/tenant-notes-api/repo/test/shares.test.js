import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startApp } from './helpers.js';

async function sharedNote(app, note = { title: 'Launch plan', body: 'Ship on Tuesday.' }) {
  const ada = await app.signUp('ada@example.com', 'Ada');
  const { body: team } = await ada.post('/teams', { name: 'Design' });
  const { body: created } = await ada.post(`/teams/${team.id}/notes`, note);
  const notePath = `/teams/${team.id}/notes/${created.id}`;
  const share = await ada.post(`${notePath}/shares`, {});
  return { ada, team, notePath, share };
}

const pathOf = (url) => new URL(url).pathname;

test('a share link shows the note to anyone with the link', async (t) => {
  const app = await startApp(t);
  const { share } = await sharedNote(app);
  assert.equal(share.status, 201);
  assert.match(share.body.url, /^http:\/\/notes\.test\/s\/[\w-]{43}$/);

  const page = await app.client().get(pathOf(share.body.url));
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);
  assert.match(page.body, /<h1>Launch plan<\/h1>/);
  assert.match(page.body, /Shared from Design/);
});

test('the shared page escapes the note', async (t) => {
  const app = await startApp(t);
  const { share } = await sharedNote(app, {
    title: '<b>Plan</b>',
    body: 'Line one\n<script>alert(1)</script>\n\nSecond paragraph',
  });

  const page = await app.client().get(pathOf(share.body.url));
  assert.match(page.body, /<h1>&lt;b&gt;Plan&lt;\/b&gt;<\/h1>/);
  assert.match(page.body, /<p>Line one<br>&lt;script&gt;alert\(1\)&lt;\/script&gt;<\/p>/);
  assert.match(page.body, /<p>Second paragraph<\/p>/);
  assert.doesNotMatch(page.body, /<script>/);
});

test('a revoked link stops working', async (t) => {
  const app = await startApp(t);
  const { ada, notePath, share } = await sharedNote(app);

  const revoked = await ada.delete(`${notePath}/shares/${share.body.id}`);
  assert.equal(revoked.status, 204);
  const page = await app.client().get(pathOf(share.body.url));
  assert.equal(page.status, 404);

  const list = await ada.get(`${notePath}/shares`);
  assert.ok(list.body.shares[0].revokedAt);
});

test('an unknown token is a 404 page', async (t) => {
  const app = await startApp(t);
  const page = await app.client().get('/s/not-a-real-token');
  assert.equal(page.status, 404);
  assert.match(page.body, /isn't available/);
});

test('the link list never includes the token', async (t) => {
  const app = await startApp(t);
  const { ada, notePath, share } = await sharedNote(app);
  const token = pathOf(share.body.url).split('/').pop();
  const list = await ada.get(`${notePath}/shares`);
  assert.equal(list.status, 200);
  assert.equal(list.body.shares.length, 1);
  assert.doesNotMatch(JSON.stringify(list.body), new RegExp(token));
});

test('expiresInDays must be a whole number', async (t) => {
  const app = await startApp(t);
  const { ada, notePath } = await sharedNote(app);
  const res = await ada.post(`${notePath}/shares`, { expiresInDays: 1.5 });
  assert.equal(res.status, 400);
});
