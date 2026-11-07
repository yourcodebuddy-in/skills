import { paginate } from "../lib/paginate.ts";
import { getUser } from "../lib/users.ts";

export function membersOwner(userId: string): string {
  return getUser(userId).name;
}

export function membersAudit(userId: string, action: string): string {
  const user = getUser(userId);
  return `${user.name} ${action} in members`;
}

export function membersPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function membersFirstPage<T>(rows: T[]): T[] {
  return membersPage(rows, 1);
}
