import { parseDuration } from "../config/duration.ts";

export function requestTimeout(setting: string | undefined): number {
  if (!setting) return 30_000;
  try {
    return parseDuration(setting);
  } catch {
    return 30_000;
  }
}
