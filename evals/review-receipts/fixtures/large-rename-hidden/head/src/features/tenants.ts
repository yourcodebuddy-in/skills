import { paginate } from "../lib/paginate.ts";
import { fetchUser } from "../lib/users.ts";

export function tenantsOwner(userId: string): string {
  return fetchUser(userId).name;
}

export function tenantsAudit(userId: string, action: string): string {
  const user = fetchUser(userId);
  return `${user.name} ${action} in tenants`;
}

export function tenantsPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function tenantsFirstPage<T>(rows: T[]): T[] {
  return tenantsPage(rows, 1);
}
