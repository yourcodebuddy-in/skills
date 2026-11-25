// src/lib/retry.js exports withRetry and nothing imports it.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { check, load, repo } from './support/harness.mjs';

const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') {
      continue;
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else {
      files.push(full);
    }
  }
};
walk(repo);

const references = files
  .filter((file) => relative(repo, file) !== join('src', 'lib', 'retry.js'))
  .filter((file) => /withRetry|retry\.js/.test(readFileSync(file, 'utf8')))
  .map((file) => relative(repo, file));
const module = await load('src/lib/retry.js');

console.log({ exports: Object.keys(module), references });
check(typeof module.withRetry === 'function' && references.length === 0, 'withRetry is exported and never referenced');
