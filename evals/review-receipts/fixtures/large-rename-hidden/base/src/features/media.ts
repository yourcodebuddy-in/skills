import { paginate } from "../lib/paginate.ts";
import { getUser } from "../lib/users.ts";

export function mediaOwner(userId: string): string {
  return getUser(userId).name;
}

export function mediaAudit(userId: string, action: string): string {
  const user = getUser(userId);
  return `${user.name} ${action} in media`;
}

export function mediaPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function mediaFirstPage<T>(rows: T[]): T[] {
  return mediaPage(rows, 1);
}
