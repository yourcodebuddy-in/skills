import { pathToFileURL } from "node:url";
const load = (p) => import(pathToFileURL(`${process.cwd()}/${p}`).href);
const { handle } = await load("src/routes.ts");
const { startSession } = await load("src/session.ts");
const { seed } = await load("src/store.ts");
seed([{ id: "inv_1", accountId: "acct_a", amountCents: 1200, notes: "" }]);
startSession("token_b", "acct_b");
const r = handle({ method: "GET", path: "/invoices/inv_1", headers: { authorization: "Bearer token_b" } });
process.exit(r.status === 200 ? 0 : 1);
