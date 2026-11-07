import { paginate } from "../lib/paginate.ts";
import { getUser } from "../lib/users.ts";

export function ticketsOwner(userId: string): string {
  return getUser(userId).name;
}

export function ticketsAudit(userId: string, action: string): string {
  const user = getUser(userId);
  return `${user.name} ${action} in tickets`;
}

export function ticketsPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function ticketsFirstPage<T>(rows: T[]): T[] {
  return ticketsPage(rows, 1);
}
