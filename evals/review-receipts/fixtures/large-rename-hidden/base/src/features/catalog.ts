import { paginate } from "../lib/paginate.ts";
import { getUser } from "../lib/users.ts";

export function catalogOwner(userId: string): string {
  return getUser(userId).name;
}

export function catalogAudit(userId: string, action: string): string {
  const user = getUser(userId);
  return `${user.name} ${action} in catalog`;
}

export function catalogPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function catalogFirstPage<T>(rows: T[]): T[] {
  return catalogPage(rows, 1);
}
