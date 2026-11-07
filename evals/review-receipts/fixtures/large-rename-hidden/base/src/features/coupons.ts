import { paginate } from "../lib/paginate.ts";
import { getUser } from "../lib/users.ts";

export function couponsOwner(userId: string): string {
  return getUser(userId).name;
}

export function couponsAudit(userId: string, action: string): string {
  const user = getUser(userId);
  return `${user.name} ${action} in coupons`;
}

export function couponsPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function couponsFirstPage<T>(rows: T[]): T[] {
  return couponsPage(rows, 1);
}
