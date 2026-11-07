import { paginate } from "../lib/paginate.ts";
import { getUser } from "../lib/users.ts";

export function reportsOwner(userId: string): string {
  return getUser(userId).name;
}

export function reportsAudit(userId: string, action: string): string {
  const user = getUser(userId);
  return `${user.name} ${action} in reports`;
}

export function reportsPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function reportsFirstPage<T>(rows: T[]): T[] {
  return reportsPage(rows, 1);
}
