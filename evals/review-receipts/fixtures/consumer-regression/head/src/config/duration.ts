const UNITS: Record<string, number> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000 };

export function parseDuration(text: string): number | null {
  const match = /^(\d+)(ms|s|m|h)$/.exec(text.trim());
  if (!match) return null;
  return Number(match[1]) * UNITS[match[2]];
}
