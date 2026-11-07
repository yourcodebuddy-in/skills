import { paginate } from "../lib/paginate.ts";
import { getUser } from "../lib/users.ts";

export function domainsOwner(userId: string): string {
  return getUser(userId).name;
}

export function domainsAudit(userId: string, action: string): string {
  const user = getUser(userId);
  return `${user.name} ${action} in domains`;
}

export function domainsPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function domainsFirstPage<T>(rows: T[]): T[] {
  return domainsPage(rows, 1);
}
