import { pathToFileURL } from "node:url";
const { intervalFor } = await import(pathToFileURL(`${process.cwd()}/src/jobs/scheduler.ts`).href);
process.exit(intervalFor("soon") === null ? 0 : 1);
