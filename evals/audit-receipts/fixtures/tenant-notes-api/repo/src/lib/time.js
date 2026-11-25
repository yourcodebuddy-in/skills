export const DAY_MS = 24 * 60 * 60 * 1000;

export const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);

export const toIso = (date) => date.toISOString();

export const utcDay = (date) => date.toISOString().slice(0, 10);

export const formatDay = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
