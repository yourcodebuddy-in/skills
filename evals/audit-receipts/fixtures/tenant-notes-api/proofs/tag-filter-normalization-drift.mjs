// Tags are stored through normalizeTag, but the list filter normalizes its input with a different rule.
import { check, load, startApp } from './support/harness.mjs';

const { normalizeTag } = await load('src/notes/tags.js');

const app = await startApp();
const ada = await app.signUp('ada@example.com', 'Ada');
const { body: team } = await ada.post('/teams', { name: 'Design' });
const { body: note } = await ada.post(`/teams/${team.id}/notes`, { title: 'Q3 plan', body: '', tags: ['Road Map'] });

const list = async (tag) =>
  (await ada.get(`/teams/${team.id}/notes?tag=${encodeURIComponent(tag)}`)).body.notes.length;
const results = {
  storedTags: note.tags,
  'Road Map': await list('Road Map'),
  '#road-map': await list('#road-map'),
  'road-map': await list('road-map'),
};
app.close();

console.log({ normalizeTag: normalizeTag('Road Map'), ...results });
check(
  results.storedTags[0] === 'road-map' && results['Road Map'] === 0 && results['#road-map'] === 0 && results['road-map'] === 1,
  'a note saved with tag "Road Map" is not found by ?tag=Road Map or ?tag=#road-map, only by the stored form',
);
