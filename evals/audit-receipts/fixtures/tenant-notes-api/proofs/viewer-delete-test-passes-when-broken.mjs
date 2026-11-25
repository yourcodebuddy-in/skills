// "a viewer cannot delete a note" sends the DELETE to /notes/undefined (note.id instead of note.body.id),
// so it passes even when viewers are allowed to delete. Shown on a temp copy with the role check loosened.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { check, repo } from './support/harness.mjs';

const work = mkdtempSync(join(tmpdir(), 'viewer-delete-'));
try {
  const copy = join(work, 'repo');
  const gitDir = join(repo, '.git');
  cpSync(repo, copy, { recursive: true, filter: (source) => source !== gitDir && !source.startsWith(gitDir + sep) });

  const routes = join(copy, 'src/routes/notes.js');
  const original = readFileSync(routes, 'utf8');
  const block = "router.add('DELETE', '/teams/:teamId/notes/:noteId', (ctx) => {\n    const user = requireUser(ctx);\n    const { teamId } = ctx.params;\n    requireRole(db, teamId, user.id, 'editor');";
  if (!original.includes(block)) {
    throw new Error('could not find the delete route to patch');
  }
  writeFileSync(routes, original.replace(block, block.replace("'editor'", "'viewer'")));

  const testRun = spawnSync(
    process.execPath,
    ['--test', '--test-name-pattern=a viewer cannot delete a note', 'test/notes.test.js'],
    { cwd: copy, encoding: 'utf8' },
  );
  const passed = testRun.status === 0 && /# pass 1|ℹ pass 1/.test(testRun.stdout);

  const probe = join(copy, 'probe.mjs');
  writeFileSync(
    probe,
    `import { startApp, teamWithMember } from './test/helpers.js';
const cleanups = [];
const app = await startApp({ after: (fn) => cleanups.push(fn) });
const { owner, member, team } = await teamWithMember(app, 'viewer');
const { body: note } = await owner.post('/teams/' + team.id + '/notes', { title: 'Runbook', body: 'Steps' });
const res = await member.delete('/teams/' + team.id + '/notes/' + note.id);
console.log(res.status);
for (const fn of cleanups) fn();
`,
  );
  const probeRun = spawnSync(process.execPath, [probe], { cwd: copy, encoding: 'utf8' });
  const viewerDeleted = probeRun.stdout.trim() === '204';

  console.log({ testExit: testRun.status, testPassed: passed, viewerDeleteStatus: probeRun.stdout.trim() });
  check(
    passed && viewerDeleted,
    'with viewers allowed to delete (probe got 204), the test "a viewer cannot delete a note" still passes',
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}
