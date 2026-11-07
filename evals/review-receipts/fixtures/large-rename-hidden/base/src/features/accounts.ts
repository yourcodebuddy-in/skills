import { paginate } from "../lib/paginate.ts";
import { getUser } from "../lib/users.ts";

export function accountsOwner(userId: string): string {
  return getUser(userId).name;
}

export function accountsAudit(userId: string, action: string): string {
  const user = getUser(userId);
  return `${user.name} ${action} in accounts`;
}

export function accountsPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function accountsFirstPage<T>(rows: T[]): T[] {
  return accountsPage(rows, 1);
}
