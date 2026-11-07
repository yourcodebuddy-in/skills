import { paginate } from "../lib/paginate.ts";
import { getUser } from "../lib/users.ts";

export function auditOwner(userId: string): string {
  return getUser(userId).name;
}

export function auditAudit(userId: string, action: string): string {
  const user = getUser(userId);
  return `${user.name} ${action} in audit`;
}

export function auditPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function auditFirstPage<T>(rows: T[]): T[] {
  return auditPage(rows, 1);
}
