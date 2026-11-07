export function percentOff(cents: number, percent: number): number {
  return Math.round((cents * (100 - percent)) / 100);
}
