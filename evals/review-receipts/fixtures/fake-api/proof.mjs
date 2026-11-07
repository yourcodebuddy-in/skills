import { pathToFileURL } from "node:url";
const { runJob } = await import(pathToFileURL(`${process.cwd()}/src/jobs.ts`).href);
try {
  await runJob(async () => { throw new Error("x"); });
  process.exit(1);
} catch (error) {
  process.exit(error instanceof TypeError ? 0 : 1);
}
