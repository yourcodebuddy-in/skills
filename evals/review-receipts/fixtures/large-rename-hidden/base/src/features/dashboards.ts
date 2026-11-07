import { paginate } from "../lib/paginate.ts";
import { getUser } from "../lib/users.ts";

export function dashboardsOwner(userId: string): string {
  return getUser(userId).name;
}

export function dashboardsAudit(userId: string, action: string): string {
  const user = getUser(userId);
  return `${user.name} ${action} in dashboards`;
}

export function dashboardsPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function dashboardsFirstPage<T>(rows: T[]): T[] {
  return dashboardsPage(rows, 1);
}
