import { paginate } from "../lib/paginate.ts";
import { fetchUser } from "../lib/users.ts";

export function snippetsOwner(userId: string): string {
  return fetchUser(userId).name;
}

export function snippetsAudit(userId: string, action: string): string {
  const user = fetchUser(userId);
  return `${user.name} ${action} in snippets`;
}

export function snippetsPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function snippetsFirstPage<T>(rows: T[]): T[] {
  return snippetsPage(rows, 1);
}
