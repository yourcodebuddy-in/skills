import { paginate } from "../lib/paginate.ts";
import { getUser } from "../lib/users.ts";

export function plansOwner(userId: string): string {
  return getUser(userId).name;
}

export function plansAudit(userId: string, action: string): string {
  const user = getUser(userId);
  return `${user.name} ${action} in plans`;
}

export function plansPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function plansFirstPage<T>(rows: T[]): T[] {
  return plansPage(rows, 1);
}
