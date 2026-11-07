import { paginate } from "../lib/paginate.ts";
import { fetchUser } from "../lib/users.ts";

export function exportsOwner(userId: string): string {
  return fetchUser(userId).name;
}

export function exportsAudit(userId: string, action: string): string {
  const user = fetchUser(userId);
  return `${user.name} ${action} in exports`;
}

export function exportsPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function exportsFirstPage<T>(rows: T[]): T[] {
  return exportsPage(rows, 1);
}
