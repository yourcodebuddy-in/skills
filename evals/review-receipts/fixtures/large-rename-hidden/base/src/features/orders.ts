import { paginate } from "../lib/paginate.ts";
import { getUser } from "../lib/users.ts";

export function ordersOwner(userId: string): string {
  return getUser(userId).name;
}

export function ordersAudit(userId: string, action: string): string {
  const user = getUser(userId);
  return `${user.name} ${action} in orders`;
}

export function ordersPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function ordersFirstPage<T>(rows: T[]): T[] {
  return ordersPage(rows, 1);
}
