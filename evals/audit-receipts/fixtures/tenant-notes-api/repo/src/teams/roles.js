const RANK = { viewer: 1, editor: 2, owner: 3 };

export const ROLES = Object.keys(RANK);

export const isRole = (value) => typeof value === 'string' && Object.hasOwn(RANK, value);

export const roleAtLeast = (role, minimum) => (RANK[role] ?? 0) >= RANK[minimum];
