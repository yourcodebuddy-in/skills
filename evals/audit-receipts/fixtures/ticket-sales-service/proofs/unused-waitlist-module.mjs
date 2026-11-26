// src/services/waitlist.js and its table are never used: nothing imports the module and no route,
// job or command reaches it.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { check, ROOT } from './lib.mjs';

const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    if (entry === '.git' || entry === 'node_modules') continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path);
    else files.push(path);
  }
};
walk(ROOT);

const exported = readFileSync(join(ROOT, 'src/services/waitlist.js'), 'utf8').match(/export function (\w+)/g);
check(exported.length === 3, `waitlist.js exports ${exported.join(', ')}`);

const users = files.filter((path) => {
  if (path.endsWith('waitlist.js')) return false;
  const text = readFileSync(path, 'utf8');
  return /waitlist/i.test(text) || /joinWaitlist|notifyWaitlist|waitlistSize/.test(text);
});
const names = users.map((path) => relative(ROOT, path));
check(
  names.length === 1 && names[0] === join('migrations', '003_waitlist.sql'),
  `the only other mention is the migration that creates its table (${names.join(', ')})`,
);
