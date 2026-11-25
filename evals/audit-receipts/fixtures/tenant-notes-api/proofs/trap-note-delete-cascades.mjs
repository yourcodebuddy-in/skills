// README: "Deleting a note deletes its tags and every share link to it". True: foreign keys are switched on
// in openDatabase and both child tables use ON DELETE CASCADE.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { check, repo, startApp } from './support/harness.mjs';

const readme = readFileSync(join(repo, 'README.md'), 'utf8');
const claim = readme.includes('Deleting a note deletes its tags and every share link to it');

const app = await startApp();
const ada = await app.signUp('ada@example.com', 'Ada');
const { body: team } = await ada.post('/teams', { name: 'Design' });
const { body: note } = await ada.post(`/teams/${team.id}/notes`, { title: 'Plan', body: 'x', tags: ['a', 'b'] });
const notePath = `/teams/${team.id}/notes/${note.id}`;
const { body: share } = await ada.post(`${notePath}/shares`, {});
await ada.post(`${notePath}/shares`, { expiresInDays: 2 });

const count = (table) => app.db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE note_id = ?`).get(note.id).n;
const before = { tags: count('note_tags'), links: count('share_links') };
const deleted = await ada.delete(notePath);
const after = { tags: count('note_tags'), links: count('share_links') };
const page = await app.client().get(new URL(share.url).pathname);
const foreignKeys = app.db.prepare('PRAGMA foreign_keys').get().foreign_keys;
app.close();

console.log({ claim, foreignKeys, before, deleteStatus: deleted.status, after, sharePageStatus: page.status });
check(
  claim && foreignKeys === 1 && before.tags === 2 && before.links === 2 && deleted.status === 204 &&
    after.tags === 0 && after.links === 0 && page.status === 404,
  'deleting a note removes its tags and share links, and the old link returns 404',
);
