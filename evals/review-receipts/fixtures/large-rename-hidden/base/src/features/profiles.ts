import { paginate } from "../lib/paginate.ts";
import { getUser } from "../lib/users.ts";

export function profilesOwner(userId: string): string {
  return getUser(userId).name;
}

export function profilesAudit(userId: string, action: string): string {
  const user = getUser(userId);
  return `${user.name} ${action} in profiles`;
}

export function profilesPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function profilesFirstPage<T>(rows: T[]): T[] {
  return profilesPage(rows, 1);
}
