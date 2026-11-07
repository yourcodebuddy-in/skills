import { accountFor } from "./session.ts";
import { findById, listByAccount, updateNotes } from "./store.ts";

export type Request = { method: string; path: string; headers: Record<string, string>; body?: unknown };
export type Response = { status: number; body: unknown };

const MAX_NOTES_LENGTH = 2000;

export function handle(request: Request): Response {
  const accountId = accountFor(request.headers);
  if (!accountId) return { status: 401, body: { error: "unauthenticated" } };

  if (request.method === "GET" && request.path === "/invoices") {
    return { status: 200, body: listByAccount(accountId) };
  }

  const match = request.path.match(/^\/invoices\/([\w-]+)$/);
  if (match) {
    const invoice = findById(match[1]);
    if (!invoice) return { status: 404, body: { error: "not found" } };

    if (request.method === "GET") return { status: 200, body: invoice };

    if (request.method === "PATCH") {
      const notes = (request.body as { notes?: unknown })?.notes;
      if (typeof notes !== "string" || notes.length > MAX_NOTES_LENGTH) {
        return { status: 400, body: { error: "invalid notes" } };
      }
      updateNotes(invoice.id, notes);
      return { status: 200, body: findById(invoice.id) };
    }
  }

  return { status: 404, body: { error: "not found" } };
}
