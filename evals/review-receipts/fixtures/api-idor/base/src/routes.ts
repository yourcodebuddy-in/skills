import { accountFor } from "./session.ts";
import { listByAccount } from "./store.ts";

export type Request = { method: string; path: string; headers: Record<string, string>; body?: unknown };
export type Response = { status: number; body: unknown };

export function handle(request: Request): Response {
  const accountId = accountFor(request.headers);
  if (!accountId) return { status: 401, body: { error: "unauthenticated" } };

  if (request.method === "GET" && request.path === "/invoices") {
    return { status: 200, body: listByAccount(accountId) };
  }

  return { status: 404, body: { error: "not found" } };
}
