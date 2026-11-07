import { parseDuration } from "../config/duration.ts";

const DEFAULT_INTERVAL_MS = 60_000;

export function intervalFor(setting: string): number {
  try {
    return parseDuration(setting);
  } catch {
    return DEFAULT_INTERVAL_MS;
  }
}

export function schedule(setting: string, job: () => void): NodeJS.Timeout {
  return setInterval(job, intervalFor(setting));
}
