const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const isIsoDay = (value) => typeof value === "string" && ISO_DAY.test(value) && !Number.isNaN(Date.parse(value));

export const hasPassed = (day, now) => new Date(day).getTime() <= now.getTime();

export const addHours = (date, hours) => new Date(date.getTime() + hours * HOUR_MS);

// Inclusive range of whole UTC days, as ISO timestamps for comparing against stored ones.
export const dayRange = (fromDay, toDay) => ({
  start: new Date(fromDay).toISOString(),
  end: new Date(new Date(toDay).getTime() + DAY_MS).toISOString(),
});
