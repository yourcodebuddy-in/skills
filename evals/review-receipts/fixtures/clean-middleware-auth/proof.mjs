import { pathToFileURL } from "node:url";
const { createApp } = await import(pathToFileURL(`${process.cwd()}/src/app.ts`).href);
const app = createApp();
const denied = [undefined, "member"].every((role) => app.handle({ path: "/admin/users/export", role }).status === 403);
process.exit(denied && app.handle({ path: "/admin/users/export", role: "admin" }).status === 200 ? 0 : 1);
