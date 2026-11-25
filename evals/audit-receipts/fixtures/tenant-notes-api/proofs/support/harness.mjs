// Shared helpers for the proofs. Each proof runs with the repo copy as the working directory.
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const repo = process.cwd();

export const load = (relative) => import(pathToFileURL(join(repo, relative)).href);

export async function startApp(options = {}) {
  const { startApp: start } = await load('test/helpers.js');
  const cleanups = [];
  const t = { after: (fn) => cleanups.push(fn) };
  const app = await start(t, options);
  app.close = () => {
    for (const fn of cleanups) {
      fn();
    }
  };
  return app;
}

export function proven(message) {
  console.log(`PROVEN: ${message}`);
  process.exit(0);
}

export function notProven(message) {
  console.error(`NOT PROVEN: ${message}`);
  process.exit(1);
}

export const check = (condition, message) => (condition ? proven(message) : notProven(message));
