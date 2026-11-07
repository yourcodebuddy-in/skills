import { Router } from "./router.ts";
import { registerAdminRoutes } from "./routes/admin.ts";

export function createApp(): Router {
  const router = new Router();
  router.use("/admin", (request) => (request.role === "admin" ? null : { status: 403, body: { error: "forbidden" } }));
  registerAdminRoutes(router);
  return router;
}
