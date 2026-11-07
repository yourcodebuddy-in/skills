import { pathToFileURL } from "node:url";
const { paginate } = await import(pathToFileURL(`${process.cwd()}/src/lib/paginate.ts`).href);
const rows = Array.from({ length: 30 }, (_, i) => i);
process.exit(paginate(rows, 1, 20)[0] === 20 ? 0 : 1);
