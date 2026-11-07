import { paginate } from "../lib/paginate.ts";
import { fetchUser } from "../lib/users.ts";

export function labelsOwner(userId: string): string {
  return fetchUser(userId).name;
}

export function labelsAudit(userId: string, action: string): string {
  const user = fetchUser(userId);
  return `${user.name} ${action} in labels`;
}

export function labelsPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function labelsFirstPage<T>(rows: T[]): T[] {
  return labelsPage(rows, 1);
}
