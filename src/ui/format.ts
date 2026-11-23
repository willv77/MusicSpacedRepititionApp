import { addDays, daysBetween, localDateToDate } from '../domain/dates';
import type { LocalDate } from '../domain/types';

const fmtLong = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
const fmtShort = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const fmtFull = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const fmtWeekday = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const fmtMonthDay = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

/** "Monday, Nov 23" */
export const longDate = (d: LocalDate): string => fmtLong.format(localDateToDate(d));
/** "Sun, Nov 22" */
export const shortDate = (d: LocalDate): string => fmtShort.format(localDateToDate(d));
/** "Sun, Nov 22, 2026" */
export const fullDate = (d: LocalDate): string => fmtFull.format(localDateToDate(d));

export function plural(n: number, word: string, pluralWord = `${word}s`): string {
  return `${n} ${n === 1 ? word : pluralWord}`;
}

/** When a task is next due, relative to today: "2 days overdue", "today", "tomorrow", "Thu", "Dec 1". */
export function dueLabel(dueDate: LocalDate, today: LocalDate): string {
  const n = daysBetween(today, dueDate);
  if (n < 0) return `${plural(-n, 'day')} overdue`;
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n < 7) return fmtWeekday.format(localDateToDate(dueDate));
  return fmtMonthDay.format(localDateToDate(dueDate));
}

/** How long ago a day was: "today", "yesterday", "3 days ago" (or "in 2 days" for future days in Test Mode). */
export function agoLabel(date: LocalDate, today: LocalDate): string {
  const n = daysBetween(date, today);
  if (n === 0) return 'today';
  if (n === 1) return 'yesterday';
  if (n > 1) return `${n} days ago`;
  return n === -1 ? 'tomorrow' : `in ${-n} days`;
}

/** Section header for a day: "Today", "Yesterday", "Sun, Nov 22". */
export function dayHeader(date: LocalDate, today: LocalDate): string {
  if (date === today) return 'Today';
  if (date === addDays(today, -1)) return 'Yesterday';
  return shortDate(date);
}

export function tempoText(tempo: number | null): string {
  return tempo == null ? '—' : `${tempo} BPM`;
}
