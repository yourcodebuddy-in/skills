import { paginate } from "../lib/paginate.ts";
import { fetchUser } from "../lib/users.ts";

export function mailersOwner(userId: string): string {
  return fetchUser(userId).name;
}

export function mailersAudit(userId: string, action: string): string {
  const user = fetchUser(userId);
  return `${user.name} ${action} in mailers`;
}

export function mailersPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function mailersFirstPage<T>(rows: T[]): T[] {
  return mailersPage(rows, 1);
}
