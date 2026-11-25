// ADR 0005 says sessions.id holds the SHA-256 of the cookie token; it holds the token itself.
// Run from the root of a copy of repo/.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const { createTestApp } = await import(pathToFileURL(join(root, "apps/api/test/helpers.js")).href);
const adr = readFileSync(join(root, "docs/adr/0005-session-tokens-hashed-at-rest.md"), "utf8");
const decided = adr.includes("stores the SHA-256 of that token, never the token itself");

const t = createTestApp();
const { cookie } = await t.signUp({ admin: true });
const token = decodeURIComponent(cookie.split("=")[1]);
const raw = t.store.db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE id = ?").get(token).n;
const hashed = t.store.db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE id = ?").get(createHash("sha256").update(token).digest("hex")).n;

// Anyone holding a copy of the table can use the stored id as a cookie.
const fromBackup = t.store.db.prepare("SELECT id FROM sessions").get().id;
const me = await t.request({ path: "/api/account/me", cookie: `sid=${encodeURIComponent(fromBackup)}` });

console.log("ADR requires hashed ids:", decided, "| rows with raw token:", raw, "| rows with hash:", hashed);
console.log("stored id works as a cookie:", me.status, me.body?.user?.role);
process.exit(decided && raw === 1 && hashed === 0 && me.status === 200 ? 0 : 1);
