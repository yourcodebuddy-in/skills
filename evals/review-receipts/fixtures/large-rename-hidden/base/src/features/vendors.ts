import { paginate } from "../lib/paginate.ts";
import { getUser } from "../lib/users.ts";

export function vendorsOwner(userId: string): string {
  return getUser(userId).name;
}

export function vendorsAudit(userId: string, action: string): string {
  const user = getUser(userId);
  return `${user.name} ${action} in vendors`;
}

export function vendorsPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function vendorsFirstPage<T>(rows: T[]): T[] {
  return vendorsPage(rows, 1);
}
