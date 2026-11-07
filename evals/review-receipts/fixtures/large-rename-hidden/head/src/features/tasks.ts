import { paginate } from "../lib/paginate.ts";
import { fetchUser } from "../lib/users.ts";

export function tasksOwner(userId: string): string {
  return fetchUser(userId).name;
}

export function tasksAudit(userId: string, action: string): string {
  const user = fetchUser(userId);
  return `${user.name} ${action} in tasks`;
}

export function tasksPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function tasksFirstPage<T>(rows: T[]): T[] {
  return tasksPage(rows, 1);
}
