import { paginate } from "../lib/paginate.ts";
import { getUser } from "../lib/users.ts";

export function regionsOwner(userId: string): string {
  return getUser(userId).name;
}

export function regionsAudit(userId: string, action: string): string {
  const user = getUser(userId);
  return `${user.name} ${action} in regions`;
}

export function regionsPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function regionsFirstPage<T>(rows: T[]): T[] {
  return regionsPage(rows, 1);
}
