// The test "an event with a bad signature is rejected" passes with signature checking removed,
// because an unknown payment answers 404, which is also "not 200".
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { check, copyRepo, ROOT } from './lib.mjs';

const runTest = (root) =>
  spawnSync(process.execPath, ['--test', '--test-reporter=tap', '--test-name-pattern=bad signature', 'test/webhooks.test.js'], {
    cwd: root,
    encoding: 'utf8',
  });

const original = runTest(ROOT);
check(original.status === 0 && /# pass 1/.test(original.stdout), 'the test passes on the real code');

const copy = copyRepo();
const route = join(copy, 'src/routes/webhooks.js');
const source = readFileSync(route, 'utf8');
const patched = source.replace(
  /if \(!verifySignature\(req\.rawBody, req\.headers\['x-payments-signature'\], config\.payments\.webhookSecret\)\) \{/,
  'if (false) {',
);
check(patched !== source, 'signature check removed in a temp copy');
writeFileSync(route, patched);

const broken = runTest(copy);
check(broken.status === 0 && /# pass 1/.test(broken.stdout), 'the same test still passes with no signature check at all');
