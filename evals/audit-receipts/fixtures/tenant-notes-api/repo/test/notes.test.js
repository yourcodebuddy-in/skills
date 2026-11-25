import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startApp, teamWithMember } from './helpers.js';

const notesPath = (team) => `/teams/${team.id}/notes`;

test('an editor can create, read, update and delete a note', async (t) => {
  const app = await startApp(t);
  const { member: editor, team } = await teamWithMember(app, 'editor');

  const created = await editor.post(notesPath(team), {
    title: 'On-call rota',
    body: 'Weekly, Monday to Monday.',
    tags: ['Ops', '#rota', 'ops'],
  });
  assert.equal(created.status, 201);
  assert.deepEqual(created.body.tags, ['ops', 'rota']);

  const path = `${notesPath(team)}/${created.body.id}`;
  assert.equal((await editor.get(path)).body.title, 'On-call rota');

  const updated = await editor.patch(path, { body: 'Weekly, Tuesday to Tuesday.' });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.title, 'On-call rota');
  assert.equal(updated.body.body, 'Weekly, Tuesday to Tuesday.');

  assert.equal((await editor.delete(path)).status, 204);
  assert.equal((await editor.get(path)).status, 404);
});

test('a note needs a title', async (t) => {
  const app = await startApp(t);
  const ada = await app.signUp('ada@example.com');
  const { body: team } = await ada.post('/teams', { name: 'Design' });
  const res = await ada.post(notesPath(team), { title: '   ', body: 'x' });
  assert.equal(res.status, 400);
});

test('too many tags are refused', async (t) => {
  const app = await startApp(t);
  const ada = await app.signUp('ada@example.com');
  const { body: team } = await ada.post('/teams', { name: 'Design' });
  const tags = Array.from({ length: 11 }, (_, index) => `tag-${index}`);
  const res = await ada.post(notesPath(team), { title: 'Busy', body: '', tags });
  assert.equal(res.status, 400);
});

test('a viewer can read but not write', async (t) => {
  const app = await startApp(t);
  const { owner, member: viewer, team } = await teamWithMember(app, 'viewer');
  const { body: note } = await owner.post(notesPath(team), { title: 'Runbook', body: 'Steps' });

  assert.equal((await viewer.get(`${notesPath(team)}/${note.id}`)).status, 200);
  const created = await viewer.post(notesPath(team), { title: 'Mine', body: '' });
  assert.equal(created.status, 403);
  const edited = await viewer.patch(`${notesPath(team)}/${note.id}`, { title: 'Changed' });
  assert.equal(edited.status, 403);
});

test('a viewer cannot delete a note', async (t) => {
  const app = await startApp(t);
  const { owner, member: viewer, team } = await teamWithMember(app, 'viewer');
  const note = await owner.post(notesPath(team), { title: 'Runbook', body: 'Steps' });

  const res = await viewer.delete(`${notesPath(team)}/${note.id}`);
  assert.notEqual(res.status, 204);
});

test('notes from another team are not visible', async (t) => {
  const app = await startApp(t);
  const ada = await app.signUp('ada@example.com');
  const bo = await app.signUp('bo@example.com');
  const { body: adaTeam } = await ada.post('/teams', { name: 'Design' });
  const { body: boTeam } = await bo.post('/teams', { name: 'Sales' });
  const { body: note } = await ada.post(notesPath(adaTeam), { title: 'Roadmap', body: 'Private' });

  const res = await bo.get(`${notesPath(boTeam)}/${note.id}`);
  assert.equal(res.status, 404);
});

test('notes are listed newest first, a page at a time', async (t) => {
  const app = await startApp(t);
  const ada = await app.signUp('ada@example.com');
  const { body: team } = await ada.post('/teams', { name: 'Design' });
  for (const title of ['First', 'Second', 'Third']) {
    await ada.post(notesPath(team), { title, body: '' });
  }

  const page = await ada.get(`${notesPath(team)}?limit=2`);
  assert.equal(page.status, 200);
  assert.deepEqual(
    page.body.notes.map((note) => note.title),
    ['Third', 'Second'],
  );
  assert.ok(page.body.nextCursor);
});

test('notes can be filtered by tag and searched', async (t) => {
  const app = await startApp(t);
  const ada = await app.signUp('ada@example.com');
  const { body: team } = await ada.post('/teams', { name: 'Design' });
  await ada.post(notesPath(team), { title: 'Colour tokens', body: 'Use 100% of the palette', tags: ['design'] });
  await ada.post(notesPath(team), { title: 'Hiring plan', body: 'Two roles', tags: ['people'] });

  const tagged = await ada.get(`${notesPath(team)}?tag=Design`);
  assert.deepEqual(
    tagged.body.notes.map((note) => note.title),
    ['Colour tokens'],
  );

  const searched = await ada.get(`${notesPath(team)}?q=100%25`);
  assert.deepEqual(
    searched.body.notes.map((note) => note.title),
    ['Colour tokens'],
  );
});
