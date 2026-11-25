import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadConfig } from '../src/config.js';
import { parseCookies } from '../src/http/cookies.js';
import { createRouter } from '../src/http/router.js';
import { escapeHtml } from '../src/lib/html.js';
import { readPage } from '../src/lib/pagination.js';
import { normalizeTag } from '../src/notes/tags.js';
import { roleAtLeast } from '../src/teams/roles.js';

test('escapeHtml covers the five special characters', () => {
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
});

test('roles rank viewer < editor < owner', () => {
  assert.equal(roleAtLeast('owner', 'editor'), true);
  assert.equal(roleAtLeast('editor', 'editor'), true);
  assert.equal(roleAtLeast('viewer', 'editor'), false);
  assert.equal(roleAtLeast('stranger', 'viewer'), false);
});

test('tags are lower-cased, trimmed and hyphenated', () => {
  assert.equal(normalizeTag('  Road Map '), 'road-map');
  assert.equal(normalizeTag('#Ops'), 'ops');
});

test('page size is clamped', () => {
  assert.deepEqual(readPage(new URLSearchParams('limit=500')), { limit: 100, before: null });
  assert.deepEqual(readPage(new URLSearchParams('limit=0&cursor=12')), { limit: 1, before: 12 });
  assert.deepEqual(readPage(new URLSearchParams('cursor=abc')), { limit: 20, before: null });
});

test('the router matches params and reports wrong methods', () => {
  const router = createRouter();
  router.add('GET', '/teams/:teamId/notes/:noteId', () => 'note');
  const match = router.match('GET', '/teams/t1/notes/42');
  assert.deepEqual(match.params, { teamId: 't1', noteId: '42' });
  assert.deepEqual(router.match('PUT', '/teams/t1/notes/42'), { methodNotAllowed: true });
  assert.equal(router.match('GET', '/teams/t1'), null);
  assert.equal(router.match('GET', '/teams/%E0%A4%A/notes/1'), null);
});

test('cookies parse and the first value wins', () => {
  assert.deepEqual(parseCookies('sid=abc; theme=dark; sid=other'), { sid: 'abc', theme: 'dark' });
  assert.deepEqual(parseCookies(undefined), {});
});

test('config refuses http mail without a url and key', () => {
  assert.throws(() => loadConfig({ MAIL_TRANSPORT: 'http' }), /MAIL_API_URL/);
  assert.throws(() => loadConfig({ MAIL_TRANSPORT: 'smtp' }), /MAIL_TRANSPORT/);
  assert.equal(loadConfig({ PUBLIC_URL: 'https://notes.example.com/' }).publicUrl, 'https://notes.example.com');
});
