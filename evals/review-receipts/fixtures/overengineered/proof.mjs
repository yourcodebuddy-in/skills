import { existsSync } from "node:fs";
process.exit(existsSync("src/notifications/registry.ts") ? 0 : 1);
