import { paginate } from "../lib/paginate.ts";
import { getUser } from "../lib/users.ts";

export function tenantsOwner(userId: string): string {
  return getUser(userId).name;
}

export function tenantsAudit(userId: string, action: string): string {
  const user = getUser(userId);
  return `${user.name} ${action} in tenants`;
}

export function tenantsPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function tenantsFirstPage<T>(rows: T[]): T[] {
  return tenantsPage(rows, 1);
}
