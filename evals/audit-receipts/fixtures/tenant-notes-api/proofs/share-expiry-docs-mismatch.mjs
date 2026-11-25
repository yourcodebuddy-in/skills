// README and docs/api.md say links last 7 days by default and at most 30; the code defaults to 30 with no maximum.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { check, load, repo, startApp } from './support/harness.mjs';

const { DAY_MS } = await load('src/lib/time.js');
const readme = readFileSync(join(repo, 'README.md'), 'utf8');
const api = readFileSync(join(repo, 'docs/api.md'), 'utf8');
const docsSay =
  readme.includes('Share links last 7 days') &&
  readme.includes('from 1 to 30') &&
  api.includes('a whole number from 1 to 30 and defaults to 7');

const app = await startApp();
const ada = await app.signUp('ada@example.com', 'Ada');
const { body: team } = await ada.post('/teams', { name: 'Design' });
const { body: note } = await ada.post(`/teams/${team.id}/notes`, { title: 'Plan', body: '' });
const sharesPath = `/teams/${team.id}/notes/${note.id}/shares`;
const byDefault = await ada.post(sharesPath, {});
const long = await ada.post(sharesPath, { expiresInDays: 3650 });
const start = app.clock.now.getTime();
app.close();

const defaultDays = (new Date(byDefault.body.expiresAt).getTime() - start) / DAY_MS;
const longDays = (new Date(long.body.expiresAt).getTime() - start) / DAY_MS;
console.log({ docsSay, defaultDays, longStatus: long.status, longDays });
check(
  docsSay && defaultDays === 30 && long.status === 201 && longDays === 3650,
  'docs promise a 7-day default and a 30-day maximum; the code gives 30 days by default and accepts 3650',
);
