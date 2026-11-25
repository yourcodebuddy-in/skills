import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from '../constants.js';

const DIGITS = /^\d+$/;

export function readPage(searchParams) {
  const requested = Number.parseInt(searchParams.get('limit') ?? '', 10);
  const limit = Number.isNaN(requested)
    ? PAGE_SIZE_DEFAULT
    : Math.min(Math.max(requested, 1), PAGE_SIZE_MAX);

  const cursor = searchParams.get('cursor');
  const before = cursor && DIGITS.test(cursor) ? Number(cursor) : null;

  return { limit, before };
}

// Callers fetch limit + 1 rows so we can tell whether another page exists.
export function toPage(rows, limit) {
  const items = rows.slice(0, limit);
  const nextCursor = rows.length > limit ? String(rows[limit].id) : null;
  return { items, nextCursor };
}
