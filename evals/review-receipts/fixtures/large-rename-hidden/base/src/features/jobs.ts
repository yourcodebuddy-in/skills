import { paginate } from "../lib/paginate.ts";
import { getUser } from "../lib/users.ts";

export function jobsOwner(userId: string): string {
  return getUser(userId).name;
}

export function jobsAudit(userId: string, action: string): string {
  const user = getUser(userId);
  return `${user.name} ${action} in jobs`;
}

export function jobsPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function jobsFirstPage<T>(rows: T[]): T[] {
  return jobsPage(rows, 1);
}
