// "rejects a stale timestamp" signs the event object instead of the body string, so it fails on the
// signature and still passes when the timestamp check is removed. Run from the root of a copy of repo/.
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "stale-proof-"));
try {
  const gitDir = join(process.cwd(), ".git");
  cpSync(process.cwd(), dir, { recursive: true, filter: (source) => source !== gitDir && !source.startsWith(`${gitDir}${sep}`) });
  const file = join(dir, "packages/payments/src/webhooks.js");
  const source = readFileSync(file, "utf8");
  const check = /  if \(Math\.abs\(nowSeconds - timestamp\) > toleranceSeconds\) \{\n.*\n  \}\n/;
  if (!check.test(source)) {
    console.log("timestamp check not found");
    process.exit(1);
  }
  writeFileSync(file, source.replace(check, ""));

  const run = spawnSync(process.execPath, ["--test", "--test-reporter=spec", "packages/payments/test/webhooks.test.js"], { cwd: dir, encoding: "utf8" });
  const staleTestPassed = /✔ rejects a stale timestamp/.test(run.stdout);
  console.log("webhook tests with the timestamp check removed: exit", run.status, "| stale test passed:", staleTestPassed);

  // The patched code now accepts an hour-old, correctly signed payload.
  const { signatureHeader, verifyWebhook } = await import(pathToFileURL(file).href);
  const body = JSON.stringify({ id: "evt_old", type: "payment.succeeded", data: {} });
  const now = 1_790_000_000;
  let accepted = false;
  try {
    verifyWebhook({ secret: "s", header: signatureHeader("s", now - 3600, body), body, nowSeconds: now });
    accepted = true;
  } catch {
    accepted = false;
  }
  console.log("patched code accepts an hour-old event:", accepted);
  process.exit(run.status === 0 && staleTestPassed && accepted ? 0 : 1);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
