import { paginate } from "../lib/paginate.ts";
import { fetchUser } from "../lib/users.ts";

export function webhooksOwner(userId: string): string {
  return fetchUser(userId).name;
}

export function webhooksAudit(userId: string, action: string): string {
  const user = fetchUser(userId);
  return `${user.name} ${action} in webhooks`;
}

export function webhooksPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function webhooksFirstPage<T>(rows: T[]): T[] {
  return webhooksPage(rows, 1);
}
