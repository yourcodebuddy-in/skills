import { readFileSync } from "node:fs";
const source = readFileSync("src/csrf.ts", "utf8");
process.exit(source.includes("timingSafeEqual") ? 1 : 0);
