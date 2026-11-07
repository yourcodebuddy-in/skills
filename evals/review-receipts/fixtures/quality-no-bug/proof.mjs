import { readFileSync } from "node:fs";
const source = readFileSync("src/reports/overdue.ts", "utf8");
process.exit(source.includes(".find(") && !source.includes("isOverdue") ? 0 : 1);
