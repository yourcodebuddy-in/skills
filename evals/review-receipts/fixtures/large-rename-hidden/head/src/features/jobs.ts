import { paginate } from "../lib/paginate.ts";
import { fetchUser } from "../lib/users.ts";

export function jobsOwner(userId: string): string {
  return fetchUser(userId).name;
}

export function jobsAudit(userId: string, action: string): string {
  const user = fetchUser(userId);
  return `${user.name} ${action} in jobs`;
}

export function jobsPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function jobsFirstPage<T>(rows: T[]): T[] {
  return jobsPage(rows, 1);
}
