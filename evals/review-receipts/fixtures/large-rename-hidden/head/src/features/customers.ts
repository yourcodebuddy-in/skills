import { paginate } from "../lib/paginate.ts";
import { fetchUser } from "../lib/users.ts";

export function customersOwner(userId: string): string {
  return fetchUser(userId).name;
}

export function customersAudit(userId: string, action: string): string {
  const user = fetchUser(userId);
  return `${user.name} ${action} in customers`;
}

export function customersPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function customersFirstPage<T>(rows: T[]): T[] {
  return customersPage(rows, 1);
}
