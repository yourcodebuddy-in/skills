import { paginate } from "../lib/paginate.ts";
import { fetchUser } from "../lib/users.ts";

export function brandingOwner(userId: string): string {
  return fetchUser(userId).name;
}

export function brandingAudit(userId: string, action: string): string {
  const user = fetchUser(userId);
  return `${user.name} ${action} in branding`;
}

export function brandingPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function brandingFirstPage<T>(rows: T[]): T[] {
  return brandingPage(rows, 1);
}
