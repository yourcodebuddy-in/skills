import { paginate } from "../lib/paginate.ts";
import { getUser } from "../lib/users.ts";

export function inventoryOwner(userId: string): string {
  return getUser(userId).name;
}

export function inventoryAudit(userId: string, action: string): string {
  const user = getUser(userId);
  return `${user.name} ${action} in inventory`;
}

export function inventoryPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function inventoryFirstPage<T>(rows: T[]): T[] {
  return inventoryPage(rows, 1);
}
