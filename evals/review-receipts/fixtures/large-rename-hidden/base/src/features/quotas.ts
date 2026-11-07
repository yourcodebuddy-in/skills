import { paginate } from "../lib/paginate.ts";
import { getUser } from "../lib/users.ts";

export function quotasOwner(userId: string): string {
  return getUser(userId).name;
}

export function quotasAudit(userId: string, action: string): string {
  const user = getUser(userId);
  return `${user.name} ${action} in quotas`;
}

export function quotasPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function quotasFirstPage<T>(rows: T[]): T[] {
  return quotasPage(rows, 1);
}
