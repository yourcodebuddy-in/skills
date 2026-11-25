// share_links.expires_at is ISO text but is compared with a number, and in SQLite text always sorts above numbers.
import { check, load, startApp } from './support/harness.mjs';

const { addDays } = await load('src/lib/time.js');

const app = await startApp();
const ada = await app.signUp('ada@example.com', 'Ada');
const { body: team } = await ada.post('/teams', { name: 'Design' });
const { body: note } = await ada.post(`/teams/${team.id}/notes`, { title: 'Offer letter draft', body: 'Salary: 90k' });
const { body: share } = await ada.post(`/teams/${team.id}/notes/${note.id}/shares`, { expiresInDays: 1 });

app.clock.now = addDays(app.clock.now, 90);
const page = await app.client().get(new URL(share.url).pathname);
const expired = new Date(share.expiresAt) < app.clock.now;
app.close();

console.log({ expiresAt: share.expiresAt, now: app.clock.now.toISOString(), status: page.status });
check(
  expired && page.status === 200 && page.body.includes('Salary: 90k'),
  'a share link that expired 89 days ago still serves the note',
);
