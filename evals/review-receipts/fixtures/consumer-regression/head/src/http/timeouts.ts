import { parseDuration } from "../config/duration.ts";

export function requestTimeout(setting: string | undefined): number {
  if (!setting) return 30_000;
  return parseDuration(setting) ?? 30_000;
}
