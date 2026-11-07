import { paginate } from "../lib/paginate.ts";
import { fetchUser } from "../lib/users.ts";

export function invoicesOwner(userId: string): string {
  return fetchUser(userId).name;
}

export function invoicesAudit(userId: string, action: string): string {
  const user = fetchUser(userId);
  return `${user.name} ${action} in invoices`;
}

export function invoicesPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function invoicesFirstPage<T>(rows: T[]): T[] {
  return invoicesPage(rows, 1);
}
