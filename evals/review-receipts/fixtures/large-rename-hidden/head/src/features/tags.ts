import { paginate } from "../lib/paginate.ts";
import { fetchUser } from "../lib/users.ts";

export function tagsOwner(userId: string): string {
  return fetchUser(userId).name;
}

export function tagsAudit(userId: string, action: string): string {
  const user = fetchUser(userId);
  return `${user.name} ${action} in tags`;
}

export function tagsPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function tagsFirstPage<T>(rows: T[]): T[] {
  return tagsPage(rows, 1);
}
