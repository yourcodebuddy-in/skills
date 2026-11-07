import { paginate } from "../lib/paginate.ts";
import { getUser } from "../lib/users.ts";

export function subscriptionsOwner(userId: string): string {
  return getUser(userId).name;
}

export function subscriptionsAudit(userId: string, action: string): string {
  const user = getUser(userId);
  return `${user.name} ${action} in subscriptions`;
}

export function subscriptionsPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function subscriptionsFirstPage<T>(rows: T[]): T[] {
  return subscriptionsPage(rows, 1);
}
