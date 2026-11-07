export type Request = { path: string; role?: string; query?: Record<string, string> };
export type Response = { status: number; body: unknown };
type Handler = (request: Request) => Response;
type Guard = (request: Request) => Response | null;

export class Router {
  private guards: { prefix: string; guard: Guard }[] = [];
  private routes = new Map<string, Handler>();

  use(prefix: string, guard: Guard): void {
    this.guards.push({ prefix, guard });
  }

  get(path: string, handler: Handler): void {
    this.routes.set(path, handler);
  }

  handle(request: Request): Response {
    for (const { prefix, guard } of this.guards) {
      if (request.path === prefix || request.path.startsWith(`${prefix}/`)) {
        const rejected = guard(request);
        if (rejected) return rejected;
      }
    }
    const handler = this.routes.get(request.path);
    return handler ? handler(request) : { status: 404, body: { error: "not found" } };
  }
}
