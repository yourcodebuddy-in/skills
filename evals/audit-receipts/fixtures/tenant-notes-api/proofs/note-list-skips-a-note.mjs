// Following nextCursor skips one note at every page boundary.
import { check, startApp } from './support/harness.mjs';

const app = await startApp();
const ada = await app.signUp('ada@example.com', 'Ada');
const { body: team } = await ada.post('/teams', { name: 'Design' });
const created = [];
for (let index = 1; index <= 7; index += 1) {
  const { body } = await ada.post(`/teams/${team.id}/notes`, { title: `Note ${index}`, body: '' });
  created.push(body.id);
}

const seen = [];
let cursor = null;
for (let guard = 0; guard < 20; guard += 1) {
  const query = cursor ? `?limit=2&cursor=${cursor}` : '?limit=2';
  const { body } = await ada.get(`/teams/${team.id}/notes${query}`);
  seen.push(...body.notes.map((note) => note.id));
  cursor = body.nextCursor;
  if (!cursor) {
    break;
  }
}
app.close();

const missing = created.filter((id) => !seen.includes(id));
console.log({ created, seen, missing });
check(missing.length > 0, `paging through 7 notes two at a time never returns notes ${missing.join(', ')}`);
