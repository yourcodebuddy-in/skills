import type { Router } from "../router.ts";
import { users } from "../users.ts";

export function registerAdminRoutes(router: Router): void {
  router.get("/admin/users/count", () => ({ status: 200, body: { count: users.length } }));
}
