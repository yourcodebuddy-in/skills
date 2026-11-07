import { paginate } from "../lib/paginate.ts";
import { getUser } from "../lib/users.ts";

export function groupsOwner(userId: string): string {
  return getUser(userId).name;
}

export function groupsAudit(userId: string, action: string): string {
  const user = getUser(userId);
  return `${user.name} ${action} in groups`;
}

export function groupsPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function groupsFirstPage<T>(rows: T[]): T[] {
  return groupsPage(rows, 1);
}
