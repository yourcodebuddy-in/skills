import { paginate } from "../lib/paginate.ts";
import { fetchUser } from "../lib/users.ts";

export function projectsOwner(userId: string): string {
  return fetchUser(userId).name;
}

export function projectsAudit(userId: string, action: string): string {
  const user = fetchUser(userId);
  return `${user.name} ${action} in projects`;
}

export function projectsPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function projectsFirstPage<T>(rows: T[]): T[] {
  return projectsPage(rows, 1);
}
