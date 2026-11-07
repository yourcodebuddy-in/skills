import { paginate } from "../lib/paginate.ts";
import { getUser } from "../lib/users.ts";

export function flagsOwner(userId: string): string {
  return getUser(userId).name;
}

export function flagsAudit(userId: string, action: string): string {
  const user = getUser(userId);
  return `${user.name} ${action} in flags`;
}

export function flagsPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function flagsFirstPage<T>(rows: T[]): T[] {
  return flagsPage(rows, 1);
}
