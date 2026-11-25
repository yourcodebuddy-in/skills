// An editor of team A changes a note in team B by sending B's note id under A's team id.
import { check, startApp } from './support/harness.mjs';

const app = await startApp();
const ada = await app.signUp('ada@example.com', 'Ada');
const bo = await app.signUp('bo@example.com', 'Bo');
const { body: adaTeam } = await ada.post('/teams', { name: 'Design' });
const { body: boTeam } = await bo.post('/teams', { name: 'Sales' });
const { body: note } = await bo.post(`/teams/${boTeam.id}/notes`, {
  title: 'Q3 pipeline',
  body: 'Confidential numbers',
});

const read = await ada.get(`/teams/${adaTeam.id}/notes/${note.id}`);
const patch = await ada.patch(`/teams/${adaTeam.id}/notes/${note.id}`, { title: 'Overwritten by Ada' });
const after = await bo.get(`/teams/${boTeam.id}/notes/${note.id}`);
app.close();

console.log({ readStatus: read.status, patchStatus: patch.status, leakedBody: patch.body.body, titleSeenByBo: after.body.title });
check(
  read.status === 404 &&
    patch.status === 200 &&
    patch.body.body === 'Confidential numbers' &&
    after.body.title === 'Overwritten by Ada',
  "a member of another team rewrote team B's note and got its body back, though GET of the same id is 404",
);
