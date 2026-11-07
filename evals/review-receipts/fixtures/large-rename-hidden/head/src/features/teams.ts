import { paginate } from "../lib/paginate.ts";
import { fetchUser } from "../lib/users.ts";

export function teamsOwner(userId: string): string {
  return fetchUser(userId).name;
}

export function teamsAudit(userId: string, action: string): string {
  const user = fetchUser(userId);
  return `${user.name} ${action} in teams`;
}

export function teamsPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function teamsFirstPage<T>(rows: T[]): T[] {
  return teamsPage(rows, 1);
}
