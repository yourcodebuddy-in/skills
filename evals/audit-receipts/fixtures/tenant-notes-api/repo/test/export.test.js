import assert from 'node:assert/strict';
import { test } from 'node:test';
import { csvCell, toCsv } from '../src/export/csv.js';
import { startApp } from './helpers.js';

test('csv cells are quoted only when they need it', () => {
  assert.equal(csvCell('plain'), 'plain');
  assert.equal(csvCell('a, b'), '"a, b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('two\nlines'), '"two\nlines"');
  assert.equal(csvCell(null), '');
  assert.equal(csvCell(42), '42');
});

test('cells that look like spreadsheet formulas are defused', () => {
  assert.equal(csvCell('=SUM(A1:A9)'), "'=SUM(A1:A9)");
  assert.equal(csvCell('@cmd'), "'@cmd");
});

test('toCsv joins rows with CRLF and ends with one', () => {
  assert.equal(toCsv(['a', 'b'], [[1, 2]]), 'a,b\r\n1,2\r\n');
});

test('a member can export the team notes as CSV', async (t) => {
  const app = await startApp(t);
  const ada = await app.signUp('ada@example.com');
  const { body: team } = await ada.post('/teams', { name: 'Design' });
  await ada.post(`/teams/${team.id}/notes`, { title: 'Tokens, v2', body: 'x', tags: ['design', 'ui'] });

  const res = await ada.get(`/teams/${team.id}/export.csv?columns=title,tags,author`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-disposition'), /attachment; filename="notes-2026-03-02\.csv"/);
  assert.equal(res.body, 'title,tags,author\r\n"Tokens, v2",design ui,ada@example.com\r\n');
});

test('unknown export columns are refused', async (t) => {
  const app = await startApp(t);
  const ada = await app.signUp('ada@example.com');
  const { body: team } = await ada.post('/teams', { name: 'Design' });
  const res = await ada.get(`/teams/${team.id}/export.csv?columns=title,password_hash`);
  assert.equal(res.status, 400);
});

test('export needs membership', async (t) => {
  const app = await startApp(t);
  const ada = await app.signUp('ada@example.com');
  const bo = await app.signUp('bo@example.com');
  const { body: team } = await ada.post('/teams', { name: 'Design' });
  assert.equal((await bo.get(`/teams/${team.id}/export.csv`)).status, 404);
});
