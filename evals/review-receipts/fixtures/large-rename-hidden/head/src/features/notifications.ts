import { paginate } from "../lib/paginate.ts";
import { fetchUser } from "../lib/users.ts";

export function notificationsOwner(userId: string): string {
  return fetchUser(userId).name;
}

export function notificationsAudit(userId: string, action: string): string {
  const user = fetchUser(userId);
  return `${user.name} ${action} in notifications`;
}

export function notificationsPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function notificationsFirstPage<T>(rows: T[]): T[] {
  return notificationsPage(rows, 1);
}
