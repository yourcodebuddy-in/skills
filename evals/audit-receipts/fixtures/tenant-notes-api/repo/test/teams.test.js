import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startApp, teamWithMember } from './helpers.js';

test('the person who creates a team owns it', async (t) => {
  const app = await startApp(t);
  const ada = await app.signUp('ada@example.com');
  const res = await ada.post('/teams', { name: '  Design  ' });
  assert.equal(res.status, 201);
  assert.equal(res.body.name, 'Design');
  assert.equal(res.body.role, 'owner');

  const teams = await ada.get('/teams');
  assert.deepEqual(
    teams.body.teams.map((team) => [team.name, team.role]),
    [['Design', 'owner']],
  );
});

test('an owner can add someone by email and they get an email', async (t) => {
  const app = await startApp(t);
  const { team } = await teamWithMember(app, 'editor');

  const added = app.mailer.sent.find((message) => message.to === 'editor@example.com');
  assert.ok(added);
  assert.match(added.subject, /Platform/);
  assert.match(added.text, /as an editor/);

  const members = app.db
    .prepare('SELECT role FROM memberships WHERE team_id = ? ORDER BY role')
    .all(team.id)
    .map((row) => row.role);
  assert.deepEqual(members, ['editor', 'owner']);
});

test('adding someone without an account is a 404', async (t) => {
  const app = await startApp(t);
  const ada = await app.signUp('ada@example.com');
  const { body: team } = await ada.post('/teams', { name: 'Design' });
  const res = await ada.post(`/teams/${team.id}/members`, { email: 'nobody@example.com' });
  assert.equal(res.status, 404);
});

test('only owners manage members', async (t) => {
  const app = await startApp(t);
  const { member, team } = await teamWithMember(app, 'editor');
  await app.signUp('third@example.com');

  const res = await member.post(`/teams/${team.id}/members`, { email: 'third@example.com' });
  assert.equal(res.status, 403);
});

test('people outside a team see a 404 for it', async (t) => {
  const app = await startApp(t);
  const ada = await app.signUp('ada@example.com');
  const bo = await app.signUp('bo@example.com');
  const { body: team } = await ada.post('/teams', { name: 'Design' });

  assert.equal((await bo.get(`/teams/${team.id}/members`)).status, 404);
  assert.equal((await bo.get(`/teams/${team.id}/notes`)).status, 404);
});

test('the last owner cannot leave or step down', async (t) => {
  const app = await startApp(t);
  const ada = await app.signUp('ada@example.com');
  const { body: team } = await ada.post('/teams', { name: 'Design' });

  const leave = await ada.delete(`/teams/${team.id}/members/${ada.user.id}`);
  assert.equal(leave.status, 409);
  const demote = await ada.patch(`/teams/${team.id}/members/${ada.user.id}`, { role: 'editor' });
  assert.equal(demote.status, 409);
});

test('members can leave a team themselves', async (t) => {
  const app = await startApp(t);
  const { member, team } = await teamWithMember(app, 'viewer');
  const res = await member.delete(`/teams/${team.id}/members/${member.user.id}`);
  assert.equal(res.status, 204);
  assert.equal((await member.get(`/teams/${team.id}/notes`)).status, 404);
});

test('an owner can change a role', async (t) => {
  const app = await startApp(t);
  const { owner, member, team } = await teamWithMember(app, 'viewer');
  const res = await owner.patch(`/teams/${team.id}/members/${member.user.id}`, { role: 'editor' });
  assert.equal(res.status, 200);
  const created = await member.post(`/teams/${team.id}/notes`, { title: 'Now I can write', body: '' });
  assert.equal(created.status, 201);
});

test('roles outside the list are refused', async (t) => {
  const app = await startApp(t);
  const { owner, member, team } = await teamWithMember(app, 'viewer');
  const res = await owner.patch(`/teams/${team.id}/members/${member.user.id}`, { role: 'admin' });
  assert.equal(res.status, 400);
});
