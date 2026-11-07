import { paginate } from "../lib/paginate.ts";
import { fetchUser } from "../lib/users.ts";

export function schedulesOwner(userId: string): string {
  return fetchUser(userId).name;
}

export function schedulesAudit(userId: string, action: string): string {
  const user = fetchUser(userId);
  return `${user.name} ${action} in schedules`;
}

export function schedulesPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function schedulesFirstPage<T>(rows: T[]): T[] {
  return schedulesPage(rows, 1);
}
