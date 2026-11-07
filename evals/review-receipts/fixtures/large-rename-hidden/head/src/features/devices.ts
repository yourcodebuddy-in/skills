import { paginate } from "../lib/paginate.ts";
import { fetchUser } from "../lib/users.ts";

export function devicesOwner(userId: string): string {
  return fetchUser(userId).name;
}

export function devicesAudit(userId: string, action: string): string {
  const user = fetchUser(userId);
  return `${user.name} ${action} in devices`;
}

export function devicesPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function devicesFirstPage<T>(rows: T[]): T[] {
  return devicesPage(rows, 1);
}
