import { paginate } from "../lib/paginate.ts";
import { getUser } from "../lib/users.ts";

export function localesOwner(userId: string): string {
  return getUser(userId).name;
}

export function localesAudit(userId: string, action: string): string {
  const user = getUser(userId);
  return `${user.name} ${action} in locales`;
}

export function localesPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function localesFirstPage<T>(rows: T[]): T[] {
  return localesPage(rows, 1);
}
