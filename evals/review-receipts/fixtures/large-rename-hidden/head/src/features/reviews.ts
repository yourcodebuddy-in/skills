import { paginate } from "../lib/paginate.ts";
import { fetchUser } from "../lib/users.ts";

export function reviewsOwner(userId: string): string {
  return fetchUser(userId).name;
}

export function reviewsAudit(userId: string, action: string): string {
  const user = fetchUser(userId);
  return `${user.name} ${action} in reviews`;
}

export function reviewsPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function reviewsFirstPage<T>(rows: T[]): T[] {
  return reviewsPage(rows, 1);
}
