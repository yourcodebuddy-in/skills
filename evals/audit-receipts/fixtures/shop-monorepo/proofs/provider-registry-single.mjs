// The provider registry has one entry, and nothing uses it except to pass one name through.
// Run from the root of a copy of repo/.
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const { providers } = await import(pathToFileURL(join(root, "packages/payments/src/registry.js")).href);

const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") {
      continue;
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (full.endsWith(".js")) {
      files.push(full);
    }
  }
};
walk(root);

const count = (pattern) =>
  files.flatMap((file) => (readFileSync(file, "utf8").match(pattern) ?? []).map(() => relative(root, file)));
const registers = count(/\.register\(/g);
const creates = count(/providers\.create\(/g);
const otherMethods = count(/providers\.(has|names)\(/g);
const registryImports = count(/from "\.\/registry\.js"|registry\.js"/g);

console.log("registered:", providers.names(), "| register calls:", registers, "| create calls:", creates);
console.log("has/names used:", otherMethods, "| files importing the registry:", registryImports);
process.exit(
  providers.names().length === 1 && registers.length === 1 && creates.length === 1 && otherMethods.length === 0 && registryImports.length === 1 ? 0 : 1,
);
