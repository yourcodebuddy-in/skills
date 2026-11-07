import type { Router } from "../router.ts";
import { users } from "../users.ts";

const PAGE_SIZE = 500;

export function registerAdminRoutes(router: Router): void {
  router.get("/admin/users/count", () => ({ status: 200, body: { count: users.length } }));

  router.get("/admin/users/export", (request) => {
    const page = Math.max(Number.parseInt(request.query?.page ?? "1", 10) || 1, 1);
    const start = (page - 1) * PAGE_SIZE;
    return { status: 200, body: users.slice(start, start + PAGE_SIZE) };
  });
}
