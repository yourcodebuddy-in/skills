import { paginate } from "../lib/paginate.ts";
import { fetchUser } from "../lib/users.ts";

export function mediaOwner(userId: string): string {
  return fetchUser(userId).name;
}

export function mediaAudit(userId: string, action: string): string {
  const user = fetchUser(userId);
  return `${user.name} ${action} in media`;
}

export function mediaPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function mediaFirstPage<T>(rows: T[]): T[] {
  return mediaPage(rows, 1);
}
