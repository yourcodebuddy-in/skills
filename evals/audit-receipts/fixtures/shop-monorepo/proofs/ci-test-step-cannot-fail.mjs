// The CI Test step pipes node --test into tee under GitHub's default shell (bash -e, no pipefail),
// so the step passes when tests fail. Run from the root of a copy of repo/.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const workflow = readFileSync(join(process.cwd(), ".github/workflows/ci.yml"), "utf8");
const lines = workflow.split("\n");
const start = lines.findIndex((line) => line.trim() === "- name: Test");
let end = lines.findIndex((line, index) => index > start && line.trim().startsWith("- "));
if (end === -1) {
  end = lines.length;
}
const step = lines.slice(start, end).join("\n");
const run = step.match(/run:\s*(.+)/)?.[1] ?? "";
const pipesToTee = /node --test[^|]*\|\s*tee\b/.test(run);
const hasShell = /^\s*shell:/m.test(step) || /^\s*shell:/m.test(workflow.split("steps:")[0]);
const setsPipefail = /pipefail/.test(workflow);
console.log("step:", run);
console.log("pipes into tee:", pipesToTee, "custom shell:", hasShell, "pipefail anywhere:", setsPipefail);

// Run the same command line the way GitHub runs a step with no shell key: bash -e <script>.
const dir = mkdtempSync(join(tmpdir(), "ci-proof-"));
try {
  const script = join(dir, "step.sh");
  writeFileSync(script, `${run.replace("node --test", 'node -e "process.exit(1)"').replace("test-output.txt", join(dir, "out.txt"))}\n`);
  const asGithub = spawnSync("bash", ["-e", script], { encoding: "utf8" });
  const withPipefail = spawnSync("bash", ["--noprofile", "--norc", "-eo", "pipefail", script], { encoding: "utf8" });
  console.log("failing tests under bash -e exit", asGithub.status, "; under pipefail exit", withPipefail.status);
  process.exit(pipesToTee && !hasShell && !setsPipefail && asGithub.status === 0 && withPipefail.status !== 0 ? 0 : 1);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
