import { paginate } from "../lib/paginate.ts";
import { getUser } from "../lib/users.ts";

export function schedulesOwner(userId: string): string {
  return getUser(userId).name;
}

export function schedulesAudit(userId: string, action: string): string {
  const user = getUser(userId);
  return `${user.name} ${action} in schedules`;
}

export function schedulesPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function schedulesFirstPage<T>(rows: T[]): T[] {
  return schedulesPage(rows, 1);
}
