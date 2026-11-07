import { pathToFileURL } from "node:url";
const load = (p) => import(pathToFileURL(`${process.cwd()}/${p}`).href);
const { applyLoyaltyDiscount } = await load("src/billing/discount.ts");
const { lines } = await load("src/log.ts");
const total = applyLoyaltyDiscount({ id: "c", email: "a@example.com", orders: 12 }, 1999);
process.exit(!Number.isInteger(total) && lines.some((l) => l.includes("a@example.com")) ? 0 : 1);
