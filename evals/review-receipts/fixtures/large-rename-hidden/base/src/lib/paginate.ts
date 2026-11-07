// Pages are numbered from 1.
export function paginate<T>(rows: T[], page: number, limit: number): T[] {
  const offset = (Math.max(page, 1) - 1) * limit;
  return rows.slice(offset, offset + limit);
}
