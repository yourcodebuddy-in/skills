#!/usr/bin/env node
// Checks that every skill in skills/ follows the repo's rules. No dependencies.
//   node scripts/check-skills.mjs [repo root]

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), ".."));
const SKILLS = join(ROOT, "skills");

// Limits from the Agent Skills specification.
const MAX_NAME = 64;
const MAX_DESCRIPTION = 1024;
const MAX_LINES = 500;
const MAX_TOKENS = 5000;
const CHARS_PER_TOKEN = 4;

// The installer copies a skill's whole folder to users. Past this, test data has probably slipped in.
const MAX_SKILL_BYTES = 500_000;
const BANNED_FOLDERS = new Set(["evals", "fixtures", "tests", "node_modules"]);

const problems = [];

function filesIn(folder) {
  return readdirSync(folder).flatMap((entry) => {
    const path = join(folder, entry);
    return statSync(path).isDirectory() ? filesIn(path) : [path];
  });
}

function field(frontmatter, name) {
  return frontmatter.match(new RegExp(`^${name}:\\s*(.+)$`, "m"))?.[1]?.trim();
}

function checkSkill(name) {
  const folder = join(SKILLS, name);
  const add = (message) => problems.push(`${name}: ${message}`);
  const skillFile = join(folder, "SKILL.md");
  if (!existsSync(skillFile)) return add("no SKILL.md");

  const text = readFileSync(skillFile, "utf8");
  const frontmatter = text.match(/^---\n([\s\S]*?)\n---\n/)?.[1];
  if (!frontmatter) return add("SKILL.md has no frontmatter");

  if (field(frontmatter, "name") !== name) add(`name field "${field(frontmatter, "name")}" doesn't match the folder`);
  if (name.length > MAX_NAME || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) add("folder name must be lowercase letters, numbers, and single hyphens");
  const description = field(frontmatter, "description") ?? "";
  if (!description) add("no description");
  if (description.length > MAX_DESCRIPTION) add(`description is ${description.length} characters, over ${MAX_DESCRIPTION}`);
  if (field(frontmatter, "license") !== "MIT") add("license field should be MIT");
  if (!/^\s*version:/m.test(frontmatter)) add("no metadata.version");

  const lines = text.split("\n").length;
  if (lines > MAX_LINES) add(`SKILL.md is ${lines} lines, over ${MAX_LINES}`);
  const tokens = Math.round(text.length / CHARS_PER_TOKEN);
  if (tokens > MAX_TOKENS) add(`SKILL.md is about ${tokens} tokens, over ${MAX_TOKENS}`);

  const files = filesIn(folder);
  const bytes = files.reduce((sum, file) => sum + statSync(file).size, 0);
  if (bytes > MAX_SKILL_BYTES) add(`folder is ${bytes} bytes, over ${MAX_SKILL_BYTES}. Tests and data belong in evals/${name}/`);
  for (const file of files) {
    const banned = file.slice(folder.length + 1).split("/").find((part) => BANNED_FOLDERS.has(part));
    if (banned) add(`${banned}/ doesn't belong in a skill, because it's copied to users. Move it to evals/${name}/`);
    if (!file.endsWith(".md")) continue;
    const content = readFileSync(file, "utf8").replace(/```[\s\S]*?```/g, "");
    for (const [, link] of content.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
      if (/^[a-z]+:/.test(link)) continue;
      const target = resolve(dirname(file), link);
      if (!existsSync(target)) add(`broken link in ${file.slice(folder.length + 1)}: ${link}`);
      else if (!target.startsWith(`${folder}/`)) add(`link leaves the skill's folder in ${file.slice(folder.length + 1)}: ${link}`);
    }
  }

  // People install one skill at a time, so a skill can't rely on another.
  for (const other of skillNames) {
    if (other === name) continue;
    // A one-word name can be an ordinary word, so it only counts when written as a command or code.
    const mention = other.includes("-") ? `(^|[^\\w-])${other}([^\\w-]|$)` : `[\`/$]${other}([\`\\s.,]|$)`;
    if (files.some((file) => /\.(md|ya?ml)$/.test(file) && new RegExp(mention, "m").test(readFileSync(file, "utf8")))) add(`mentions another skill, ${other}`);
  }

  const readme = readFileSync(join(ROOT, "README.md"), "utf8");
  if (!readme.includes(`(skills/${name}/SKILL.md)`)) add("no row in the README's skill table");
  if (!existsSync(join(ROOT, "docs/skills", `${name}.md`))) add(`no docs/skills/${name}.md`);
  if (!existsSync(join(ROOT, "evals", name, "RESULTS.md"))) add(`no evals/${name}/RESULTS.md`);
  if (!readFileSync(join(ROOT, "CHANGELOG.md"), "utf8").includes(`## ${name} `)) add("no CHANGELOG.md entry");
}

const skillNames = readdirSync(SKILLS).filter((entry) => statSync(join(SKILLS, entry)).isDirectory());
if (!skillNames.length) problems.push("no skills found");
skillNames.forEach(checkSkill);

for (const problem of problems) console.log(`FAIL ${problem}`);
console.log(problems.length ? `${problems.length} problems` : `OK: ${skillNames.length} skill(s)`);
process.exit(problems.length ? 1 : 0);
