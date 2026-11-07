import { paginate } from "../lib/paginate.ts";
import { getUser } from "../lib/users.ts";

export function rolesOwner(userId: string): string {
  return getUser(userId).name;
}

export function rolesAudit(userId: string, action: string): string {
  const user = getUser(userId);
  return `${user.name} ${action} in roles`;
}

export function rolesPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function rolesFirstPage<T>(rows: T[]): T[] {
  return rolesPage(rows, 1);
}
