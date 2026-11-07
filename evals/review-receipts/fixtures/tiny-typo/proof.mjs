import { readFileSync } from "node:fs";
process.exit(readFileSync("README.md", "utf8").includes("receive one email") ? 0 : 1);
