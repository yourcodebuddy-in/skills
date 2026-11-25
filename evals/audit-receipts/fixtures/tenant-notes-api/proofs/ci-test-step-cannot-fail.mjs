// The CI test step pipes into tee. GitHub runs an unspecified-shell step as `bash -e {0}`, without pipefail,
// so the step's status is tee's and failing tests still pass the job.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { check, repo } from './support/harness.mjs';

const workflow = readFileSync(join(repo, '.github/workflows/ci.yml'), 'utf8');
const testLine = workflow.split('\n').find((line) => line.includes('node --test'));
const pipes = Boolean(testLine?.includes('| tee'));
const setsShell = /^\s*shell:/m.test(workflow) || workflow.includes('pipefail');

const work = mkdtempSync(join(tmpdir(), 'ci-pipe-'));
let status;
try {
  const run = spawnSync('bash', ['-e', '-c', `node -e "process.exit(1)" | tee ${join(work, 'out.txt')}`], {
    encoding: 'utf8',
  });
  status = run.status;
} finally {
  rmSync(work, { recursive: true, force: true });
}

console.log({ testLine: testLine?.trim(), pipes, setsShell, bashStatusWhenTestsFail: status });
check(pipes && !setsShell && status === 0, 'a failing `node --test` piped into tee exits 0 under `bash -e`');
