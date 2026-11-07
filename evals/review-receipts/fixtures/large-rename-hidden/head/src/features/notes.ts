import { paginate } from "../lib/paginate.ts";
import { fetchUser } from "../lib/users.ts";

export function notesOwner(userId: string): string {
  return fetchUser(userId).name;
}

export function notesAudit(userId: string, action: string): string {
  const user = fetchUser(userId);
  return `${user.name} ${action} in notes`;
}

export function notesPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function notesFirstPage<T>(rows: T[]): T[] {
  return notesPage(rows, 1);
}
