import { paginate } from "../lib/paginate.ts";
import { fetchUser } from "../lib/users.ts";

export function segmentsOwner(userId: string): string {
  return fetchUser(userId).name;
}

export function segmentsAudit(userId: string, action: string): string {
  const user = fetchUser(userId);
  return `${user.name} ${action} in segments`;
}

export function segmentsPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function segmentsFirstPage<T>(rows: T[]): T[] {
  return segmentsPage(rows, 1);
}
