import { paginate } from "../lib/paginate.ts";
import { getUser } from "../lib/users.ts";

export function segmentsOwner(userId: string): string {
  return getUser(userId).name;
}

export function segmentsAudit(userId: string, action: string): string {
  const user = getUser(userId);
  return `${user.name} ${action} in segments`;
}

export function segmentsPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function segmentsFirstPage<T>(rows: T[]): T[] {
  return segmentsPage(rows, 1);
}
