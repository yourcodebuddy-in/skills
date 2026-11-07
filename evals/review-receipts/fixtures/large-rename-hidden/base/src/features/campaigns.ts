import { paginate } from "../lib/paginate.ts";
import { getUser } from "../lib/users.ts";

export function campaignsOwner(userId: string): string {
  return getUser(userId).name;
}

export function campaignsAudit(userId: string, action: string): string {
  const user = getUser(userId);
  return `${user.name} ${action} in campaigns`;
}

export function campaignsPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function campaignsFirstPage<T>(rows: T[]): T[] {
  return campaignsPage(rows, 1);
}
