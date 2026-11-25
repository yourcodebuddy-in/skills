// exportNotes builds SELECT with a template, but every name has passed readExportColumns, which only
// accepts keys of a fixed Map, and the SQL fragment comes from that Map. Nothing a caller sends reaches the SQL.
import { check, load, startApp } from './support/harness.mjs';

const { readExportColumns } = await load('src/export/export.js');
const allowed = new Set(['id', 'title', 'body', 'tags', 'author', 'created_at', 'updated_at']);

const attempts = [
  'title,(SELECT password_hash FROM users)',
  'title AS x FROM users --',
  "title' OR 1=1 --",
  'n.title',
  'password_hash',
  '__proto__',
  'constructor',
  'title;DROP TABLE notes',
  'TITLE',
  'title , body , (1)',
];
let unsafe = 0;
const tryColumns = (param) => {
  try {
    const names = readExportColumns(param);
    if (!names.every((name) => allowed.has(name))) {
      unsafe += 1;
    }
  } catch (error) {
    if (error.status !== 400) {
      unsafe += 1;
    }
  }
};
for (const param of attempts) {
  tryColumns(param);
}
const alphabet = 'abcdefghijklmnopqrstuvwxyz_,() .;\'"-=*';
for (let round = 0; round < 20_000; round += 1) {
  const length = 1 + Math.floor(Math.random() * 30);
  let param = '';
  for (let index = 0; index < length; index += 1) {
    param += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  tryColumns(param);
}

const app = await startApp();
const ada = await app.signUp('ada@example.com', 'Ada');
const { body: team } = await ada.post('/teams', { name: 'Design' });
const statuses = [];
for (const param of attempts) {
  const res = await ada.get(`/teams/${team.id}/export.csv?columns=${encodeURIComponent(param)}`);
  statuses.push(res.status);
}
const leaked = (await ada.get(`/teams/${team.id}/export.csv?columns=title,author`)).body.includes('scrypt$');
app.close();

console.log({ unsafe, statuses, leaked });
check(
  unsafe === 0 && statuses.every((status) => status === 400) && !leaked,
  'every column list outside the allow-list is a 400; accepted names are always fixed keys',
);
