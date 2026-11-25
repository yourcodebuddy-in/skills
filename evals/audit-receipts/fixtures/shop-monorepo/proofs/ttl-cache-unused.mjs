// apps/api/src/cache.js (createTtlCache) is imported or called nowhere. Run from the root of a copy of repo/.
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") {
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
walk(root);

const target = join(root, "apps/api/src/cache.js");
const references = files
  .filter((file) => file !== target)
  .filter((file) => /createTtlCache|cache\.js/.test(readFileSync(file, "utf8")))
  .map((file) => relative(root, file));

console.log("exists:", files.includes(target), "| references elsewhere:", references);
process.exit(files.includes(target) && references.length === 0 ? 0 : 1);
