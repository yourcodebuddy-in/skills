import { paginate } from "../lib/paginate.ts";
import { getUser } from "../lib/users.ts";

export function uploadsOwner(userId: string): string {
  return getUser(userId).name;
}

export function uploadsAudit(userId: string, action: string): string {
  const user = getUser(userId);
  return `${user.name} ${action} in uploads`;
}

export function uploadsPage<T>(rows: T[], page: number): T[] {
  return paginate(rows, page, 20);
}

export function uploadsFirstPage<T>(rows: T[]): T[] {
  return uploadsPage(rows, 1);
}
