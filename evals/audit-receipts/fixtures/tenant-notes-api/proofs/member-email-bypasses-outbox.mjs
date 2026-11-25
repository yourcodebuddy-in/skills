// ADR 0004 says handlers never call the mailer. Adding a member calls it inline, after the membership is saved.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { check, repo, startApp } from './support/harness.mjs';

const adr = readFileSync(join(repo, 'docs/adr/0004-send-email-through-outbox.md'), 'utf8');
const adrSays = adr.includes('Request handlers and jobs never call the mailer');

const calls = [];
const downProvider = {
  async send(message) {
    calls.push(message.to);
    throw new Error('provider timed out');
  },
};

const app = await startApp({ mailer: downProvider });
const owner = await app.signUp('owner@example.com', 'Olu');
await app.signUp('sam@example.com', 'Sam');
const { body: team } = await owner.post('/teams', { name: 'Platform' });
const first = await owner.post(`/teams/${team.id}/members`, { email: 'sam@example.com', role: 'editor' });
const retry = await owner.post(`/teams/${team.id}/members`, { email: 'sam@example.com', role: 'editor' });
const memberships = app.db.prepare('SELECT COUNT(*) AS n FROM memberships WHERE team_id = ?').get(team.id).n;
const outbox = app.db.prepare('SELECT COUNT(*) AS n FROM outbox').get().n;
app.close();

console.log({ adrSays, mailerCalledFromRequest: calls, firstStatus: first.status, retryStatus: retry.status, memberships, outbox });
check(
  adrSays && calls.includes('sam@example.com') && first.status === 500 && retry.status === 409 && memberships === 2 && outbox === 0,
  'the request called the mailer directly: a provider failure returns 500 after the member was added, nothing is queued, and a retry gets 409',
);
