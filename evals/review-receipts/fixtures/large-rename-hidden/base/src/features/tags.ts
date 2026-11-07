import { paginate } from "../lib/paginate.ts";
import { getUser } from "../lib/users.ts";

export function tagsOwner(userId: string): string {
  return getUser(userId).name;
}

export function tagsAudit(userId: string, action: string): string {
  const user = getUser(userId);
  return `${user.name} ${action} in tags`;
}

export function tagsPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function tagsFirstPage<T>(rows: T[]): T[] {
  return tagsPage(rows, 1);
}
