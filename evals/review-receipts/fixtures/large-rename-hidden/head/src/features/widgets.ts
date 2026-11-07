import { paginate } from "../lib/paginate.ts";
import { fetchUser } from "../lib/users.ts";

export function widgetsOwner(userId: string): string {
  return fetchUser(userId).name;
}

export function widgetsAudit(userId: string, action: string): string {
  const user = fetchUser(userId);
  return `${user.name} ${action} in widgets`;
}

export function widgetsPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function widgetsFirstPage<T>(rows: T[]): T[] {
  return widgetsPage(rows, 1);
}
