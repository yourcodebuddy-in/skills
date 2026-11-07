import { paginate } from "../lib/paginate.ts";
import { getUser } from "../lib/users.ts";

export function partnersOwner(userId: string): string {
  return getUser(userId).name;
}

export function partnersAudit(userId: string, action: string): string {
  const user = getUser(userId);
  return `${user.name} ${action} in partners`;
}

export function partnersPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function partnersFirstPage<T>(rows: T[]): T[] {
  return partnersPage(rows, 1);
}
