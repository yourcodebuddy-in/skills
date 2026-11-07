import { paginate } from "../lib/paginate.ts";
import { fetchUser } from "../lib/users.ts";

export function shipmentsOwner(userId: string): string {
  return fetchUser(userId).name;
}

export function shipmentsAudit(userId: string, action: string): string {
  const user = fetchUser(userId);
  return `${user.name} ${action} in shipments`;
}

export function shipmentsPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function shipmentsFirstPage<T>(rows: T[]): T[] {
  return shipmentsPage(rows, 1);
}
