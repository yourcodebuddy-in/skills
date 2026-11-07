import { paginate } from "../lib/paginate.ts";
import { fetchUser } from "../lib/users.ts";

export function usageOwner(userId: string): string {
  return fetchUser(userId).name;
}

export function usageAudit(userId: string, action: string): string {
  const user = fetchUser(userId);
  return `${user.name} ${action} in usage`;
}

export function usagePage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function usageFirstPage<T>(rows: T[]): T[] {
  return usagePage(rows, 1);
}
