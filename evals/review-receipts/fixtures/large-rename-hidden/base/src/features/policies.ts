import { paginate } from "../lib/paginate.ts";
import { getUser } from "../lib/users.ts";

export function policiesOwner(userId: string): string {
  return getUser(userId).name;
}

export function policiesAudit(userId: string, action: string): string {
  const user = getUser(userId);
  return `${user.name} ${action} in policies`;
}

export function policiesPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function policiesFirstPage<T>(rows: T[]): T[] {
  return policiesPage(rows, 1);
}
