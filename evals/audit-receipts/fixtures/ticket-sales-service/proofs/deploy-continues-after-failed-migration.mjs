// scripts/deploy.sh has no `set -e`: when the migration fails on the host, it still switches the
// live release and restarts both services on code the database schema doesn't match, then reports
// success.
import { spawnSync } from 'node:child_process';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { check, ROOT, tempDir } from './lib.mjs';

const script = readFileSync(join(ROOT, 'scripts/deploy.sh'), 'utf8');
check(!/^\s*set\s+-[a-z]*e/m.test(script), 'deploy.sh never enables errexit');

const bin = tempDir();
const log = join(bin, 'calls.log');
const stub = (name, body) => {
  writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`);
  chmodSync(join(bin, name), 0o755);
};
// ssh logs every remote command and fails the one that runs the migrations.
stub('ssh', `cat > /dev/null 2>&1 || true
printf '%s\\n' "$2" >> "${log}"
case "$2" in *"boxoffice.js migrate"*) echo "Error: migration failed" >&2; exit 1;; esac
exit 0`);
stub('git', `case "$1" in rev-parse) echo abc1234;; archive) printf 'tar';; esac`);

const result = spawnSync('sh', [join(ROOT, 'scripts/deploy.sh'), 'example-host'], {
  env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
  encoding: 'utf8',
});
const calls = readFileSync(log, 'utf8').split('\n').filter(Boolean);
const migrateAt = calls.findIndex((line) => line.includes('boxoffice.js migrate'));
const switchAt = calls.findIndex((line) => line.includes("'/srv/boxoffice/current'"));
const restartAt = calls.findIndex((line) => line.includes('systemctl restart'));

check(migrateAt >= 0, 'the migration ran and failed');
check(switchAt > migrateAt, 'the live release was switched after the failed migration');
check(restartAt > migrateAt, 'both services were restarted after the failed migration');
check(result.status === 0 && result.stdout.includes('Deployed'), 'the script exited 0 and printed "Deployed"');
