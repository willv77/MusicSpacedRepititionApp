import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, isLocalDate, isoAtLocalDate, toLocalDate } from '../src/domain/dates';

describe('dates', () => {
  it('adds days across month, year and leap-day boundaries', () => {
    expect(addDays('2026-11-23', 1)).toBe('2026-11-24');
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-11-23', 60)).toBe('2027-01-22');
  });

  it('counts whole days between dates regardless of DST', () => {
    expect(daysBetween('2026-11-23', '2026-11-24')).toBe(1);
    expect(daysBetween('2026-11-24', '2026-11-23')).toBe(-1);
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2); // US DST starts Mar 8 2026
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2); // US DST ends Nov 1 2026
    expect(daysBetween('2026-01-01', '2027-01-01')).toBe(365);
  });

  it('validates LocalDate strings', () => {
    expect(isLocalDate('2026-11-23')).toBe(true);
    expect(isLocalDate('2026-02-30')).toBe(false);
    expect(isLocalDate('2026-1-5')).toBe(false);
    expect(isLocalDate(null)).toBe(false);
  });

  it('formats a Date as a local calendar day', () => {
    expect(toLocalDate(new Date(2026, 10, 23, 23, 59))).toBe('2026-11-23');
    expect(toLocalDate(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05');
  });

  it('builds a timestamp on a given local day keeping the time of day', () => {
    const iso = isoAtLocalDate('2026-12-02', new Date(2026, 10, 23, 18, 30, 15));
    const d = new Date(iso);
    expect(toLocalDate(d)).toBe('2026-12-02');
    expect(d.getHours()).toBe(18);
    expect(d.getMinutes()).toBe(30);
  });
});
