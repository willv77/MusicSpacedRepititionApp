import type { LocalDate } from './types';

const DAY_MS = 86_400_000;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function parts(d: LocalDate): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) throw new Error(`Invalid LocalDate: ${d}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function isLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = parts(value);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Local calendar day of a Date (uses the device time zone). */
export function toLocalDate(date: Date): LocalDate {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Noon local time on the given day — safe for formatting regardless of DST. */
export function localDateToDate(d: LocalDate): Date {
  const [y, m, day] = parts(d);
  return new Date(y, m - 1, day, 12, 0, 0, 0);
}

export function addDays(d: LocalDate, n: number): LocalDate {
  const [y, m, day] = parts(d);
  const dt = new Date(Date.UTC(y, m - 1, day + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Whole days from a to b (positive when b is later). */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  const [ay, am, ad] = parts(a);
  const [by, bm, bd] = parts(b);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / DAY_MS);
}

/** ISO timestamp on a given local day, using the time-of-day from `timeSource`. */
export function isoAtLocalDate(d: LocalDate, timeSource: Date): string {
  const [y, m, day] = parts(d);
  const dt = new Date(y, m - 1, day, timeSource.getHours(), timeSource.getMinutes(), timeSource.getSeconds(), timeSource.getMilliseconds());
  return dt.toISOString();
}
