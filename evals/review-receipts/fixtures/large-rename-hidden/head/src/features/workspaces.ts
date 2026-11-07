import { paginate } from "../lib/paginate.ts";
import { fetchUser } from "../lib/users.ts";

export function workspacesOwner(userId: string): string {
  return fetchUser(userId).name;
}

export function workspacesAudit(userId: string, action: string): string {
  const user = fetchUser(userId);
  return `${user.name} ${action} in workspaces`;
}

export function workspacesPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function workspacesFirstPage<T>(rows: T[]): T[] {
  return workspacesPage(rows, 1);
}
