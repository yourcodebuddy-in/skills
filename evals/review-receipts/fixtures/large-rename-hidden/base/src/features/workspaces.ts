import { paginate } from "../lib/paginate.ts";
import { getUser } from "../lib/users.ts";

export function workspacesOwner(userId: string): string {
  return getUser(userId).name;
}

export function workspacesAudit(userId: string, action: string): string {
  const user = getUser(userId);
  return `${user.name} ${action} in workspaces`;
}

export function workspacesPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function workspacesFirstPage<T>(rows: T[]): T[] {
  return workspacesPage(rows, 1);
}
