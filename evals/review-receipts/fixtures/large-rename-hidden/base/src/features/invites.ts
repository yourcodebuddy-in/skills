import { paginate } from "../lib/paginate.ts";
import { getUser } from "../lib/users.ts";

export function invitesOwner(userId: string): string {
  return getUser(userId).name;
}

export function invitesAudit(userId: string, action: string): string {
  const user = getUser(userId);
  return `${user.name} ${action} in invites`;
}

export function invitesPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function invitesFirstPage<T>(rows: T[]): T[] {
  return invitesPage(rows, 1);
}
