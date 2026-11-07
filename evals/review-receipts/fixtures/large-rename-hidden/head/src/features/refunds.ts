import { paginate } from "../lib/paginate.ts";
import { fetchUser } from "../lib/users.ts";

export function refundsOwner(userId: string): string {
  return fetchUser(userId).name;
}

export function refundsAudit(userId: string, action: string): string {
  const user = fetchUser(userId);
  return `${user.name} ${action} in refunds`;
}

export function refundsPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function refundsFirstPage<T>(rows: T[]): T[] {
  return refundsPage(rows, 1);
}
