import { paginate } from "../lib/paginate.ts";
import { fetchUser } from "../lib/users.ts";

export function integrationsOwner(userId: string): string {
  return fetchUser(userId).name;
}

export function integrationsAudit(userId: string, action: string): string {
  const user = fetchUser(userId);
  return `${user.name} ${action} in integrations`;
}

export function integrationsPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function integrationsFirstPage<T>(rows: T[]): T[] {
  return integrationsPage(rows, 1);
}
