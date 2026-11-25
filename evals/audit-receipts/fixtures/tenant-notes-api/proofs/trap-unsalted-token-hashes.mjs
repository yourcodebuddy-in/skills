// ADR 0003 chooses unsalted single-round SHA-256 for session and share tokens. The code follows it:
// tokens are 32 random bytes, only sha256(token) is stored, and lookups go by that hash.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { check, repo, startApp } from './support/harness.mjs';

const adr = readFileSync(join(repo, 'docs/adr/0003-hash-tokens-with-sha256.md'), 'utf8');
const recorded = adr.includes('no salt and a single round') && adr.includes('256 bits of entropy');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const app = await startApp();
const ada = await app.signUp('ada@example.com', 'Ada');
const login = await app.client().post('/auth/login', { email: 'ada@example.com', password: 'correct horse battery' });
const sessionToken = login.body.token;
const { body: team } = await ada.post('/teams', { name: 'Design' });
const { body: note } = await ada.post(`/teams/${team.id}/notes`, { title: 'Plan', body: '' });
const { body: share } = await ada.post(`/teams/${team.id}/notes/${note.id}/shares`, {});
const shareToken = new URL(share.url).pathname.split('/').pop();

const sessionHashes = app.db.prepare('SELECT token_hash FROM sessions').all().map((row) => row.token_hash);
const shareHashes = app.db.prepare('SELECT token_hash FROM share_links').all().map((row) => row.token_hash);
const dump = JSON.stringify([
  app.db.prepare('SELECT * FROM sessions').all(),
  app.db.prepare('SELECT * FROM share_links').all(),
]);
app.close();

const result = {
  recorded,
  sessionTokenBytes: Buffer.from(sessionToken, 'base64url').length,
  shareTokenBytes: Buffer.from(shareToken, 'base64url').length,
  sessionStoredAsHash: sessionHashes.includes(sha256(sessionToken)),
  shareStoredAsHash: shareHashes.includes(sha256(shareToken)),
  rawTokensInDb: dump.includes(sessionToken) || dump.includes(shareToken),
};
console.log(result);
check(
  result.recorded &&
    result.sessionTokenBytes === 32 &&
    result.shareTokenBytes === 32 &&
    result.sessionStoredAsHash &&
    result.shareStoredAsHash &&
    !result.rawTokensInDb,
  'tokens are 256-bit random values stored only as their SHA-256, exactly as ADR 0003 records',
);
