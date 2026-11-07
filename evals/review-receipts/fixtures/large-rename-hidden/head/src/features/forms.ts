import { paginate } from "../lib/paginate.ts";
import { fetchUser } from "../lib/users.ts";

export function formsOwner(userId: string): string {
  return fetchUser(userId).name;
}

export function formsAudit(userId: string, action: string): string {
  const user = fetchUser(userId);
  return `${user.name} ${action} in forms`;
}

export function formsPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function formsFirstPage<T>(rows: T[]): T[] {
  return formsPage(rows, 1);
}
