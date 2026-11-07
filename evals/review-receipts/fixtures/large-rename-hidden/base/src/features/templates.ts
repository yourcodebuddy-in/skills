import { paginate } from "../lib/paginate.ts";
import { getUser } from "../lib/users.ts";

export function templatesOwner(userId: string): string {
  return getUser(userId).name;
}

export function templatesAudit(userId: string, action: string): string {
  const user = getUser(userId);
  return `${user.name} ${action} in templates`;
}

export function templatesPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function templatesFirstPage<T>(rows: T[]): T[] {
  return templatesPage(rows, 1);
}
