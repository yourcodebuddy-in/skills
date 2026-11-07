import { paginate } from "../lib/paginate.ts";
import { getUser } from "../lib/users.ts";

export function billingOwner(userId: string): string {
  return getUser(userId).name;
}

export function billingAudit(userId: string, action: string): string {
  const user = getUser(userId);
  return `${user.name} ${action} in billing`;
}

export function billingPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function billingFirstPage<T>(rows: T[]): T[] {
  return billingPage(rows, 1);
}
