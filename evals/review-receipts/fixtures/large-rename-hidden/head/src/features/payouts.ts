import { paginate } from "../lib/paginate.ts";
import { fetchUser } from "../lib/users.ts";

export function payoutsOwner(userId: string): string {
  return fetchUser(userId).name;
}

export function payoutsAudit(userId: string, action: string): string {
  const user = fetchUser(userId);
  return `${user.name} ${action} in payouts`;
}

export function payoutsPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function payoutsFirstPage<T>(rows: T[]): T[] {
  return payoutsPage(rows, 1);
}
