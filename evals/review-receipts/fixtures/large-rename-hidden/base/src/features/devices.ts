import { paginate } from "../lib/paginate.ts";
import { getUser } from "../lib/users.ts";

export function devicesOwner(userId: string): string {
  return getUser(userId).name;
}

export function devicesAudit(userId: string, action: string): string {
  const user = getUser(userId);
  return `${user.name} ${action} in devices`;
}

export function devicesPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function devicesFirstPage<T>(rows: T[]): T[] {
  return devicesPage(rows, 1);
}
