const rows = new Map<string, unknown>();

export async function read<T>(key: string): Promise<T | undefined> {
  await new Promise((resolve) => setImmediate(resolve));
  return rows.get(key) as T | undefined;
}

export async function write<T>(key: string, value: T): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
  rows.set(key, value);
}

const tails = new Map<string, Promise<unknown>>();

export function withRowLock<T>(key: string, work: () => Promise<T>): Promise<T> {
  const next = (tails.get(key) ?? Promise.resolve()).then(work, work);
  tails.set(key, next.catch(() => undefined));
  return next;
}
