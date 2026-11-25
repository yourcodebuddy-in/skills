// README says SESSION_TTL_HOURS defaults to 12; the code defaults to 720 (30 days).
// Run from the root of a copy of repo/.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const load = (path) => import(pathToFileURL(join(root, path)).href);
const { loadConfig } = await load("apps/api/src/config.js");
const { createTestApp } = await load("apps/api/test/helpers.js");

const row = readFileSync(join(root, "README.md"), "utf8")
  .split("\n")
  .find((line) => line.startsWith("| `SESSION_TTL_HOURS`"));
const documented = Number(row?.split("|")[2].replace(/[`\s]/g, ""));
const config = loadConfig({ PAYMENT_WEBHOOK_SECRET: "whsec_x" });

const t = createTestApp({ config: { sessionTtlHours: config.sessionTtlHours } });
const response = await t.request({
  method: "POST",
  path: "/api/account/register",
  body: { email: "a@example.com", name: "A", password: "long enough password" },
});
const maxAge = Number(response.headers["set-cookie"].match(/Max-Age=(\d+)/)[1]);

console.log("README default:", documented, "hours; code default:", config.sessionTtlHours, "hours; cookie Max-Age:", maxAge, "s");
process.exit(documented === 12 && config.sessionTtlHours === 720 && maxAge === 720 * 3600 ? 0 : 1);
