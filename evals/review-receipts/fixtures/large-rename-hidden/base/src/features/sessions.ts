import { paginate } from "../lib/paginate.ts";
import { getUser } from "../lib/users.ts";

export function sessionsOwner(userId: string): string {
  return getUser(userId).name;
}

export function sessionsAudit(userId: string, action: string): string {
  const user = getUser(userId);
  return `${user.name} ${action} in sessions`;
}

export function sessionsPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function sessionsFirstPage<T>(rows: T[]): T[] {
  return sessionsPage(rows, 1);
}
