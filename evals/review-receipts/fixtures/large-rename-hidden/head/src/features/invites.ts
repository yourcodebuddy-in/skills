import { paginate } from "../lib/paginate.ts";
import { fetchUser } from "../lib/users.ts";

export function invitesOwner(userId: string): string {
  return fetchUser(userId).name;
}

export function invitesAudit(userId: string, action: string): string {
  const user = fetchUser(userId);
  return `${user.name} ${action} in invites`;
}

export function invitesPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function invitesFirstPage<T>(rows: T[]): T[] {
  return invitesPage(rows, 1);
}
