import { paginate } from "../lib/paginate.ts";
import { getUser } from "../lib/users.ts";

export function keysOwner(userId: string): string {
  return getUser(userId).name;
}

export function keysAudit(userId: string, action: string): string {
  const user = getUser(userId);
  return `${user.name} ${action} in keys`;
}

export function keysPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function keysFirstPage<T>(rows: T[]): T[] {
  return keysPage(rows, 1);
}
