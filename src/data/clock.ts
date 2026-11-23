import { computed, signal } from '@preact/signals';
import { isLocalDate, isoAtLocalDate, toLocalDate } from '../domain/dates';
import type { LocalDate } from '../domain/types';
import { isDesktop } from './platform';

/** Device-local Test Mode date; deliberately not part of AppData so it is never exported. */
export const TEST_DATE_KEY = 'wkv-practice:test-date';

function readTestDate(): LocalDate | null {
  try {
    const v = typeof localStorage === 'undefined' ? null : localStorage.getItem(TEST_DATE_KEY);
    return isLocalDate(v) ? v : null;
  } catch {
    return null;
  }
}

/** Test Mode is only offered on desktop browsers. */
export const testModeAvailable = isDesktop();

export const realToday = signal<LocalDate>(toLocalDate(new Date()));
export const testDate = signal<LocalDate | null>(readTestDate());

export const testModeActive = computed(() => testModeAvailable && testDate.value != null);

/** The app's notion of "today" — the simulated date in Test Mode, otherwise the device date. */
export const today = computed<LocalDate>(() => (testModeActive.value ? (testDate.value as LocalDate) : realToday.value));

export function setTestDate(d: LocalDate | null): void {
  testDate.value = d;
  try {
    if (d) localStorage.setItem(TEST_DATE_KEY, d);
    else localStorage.removeItem(TEST_DATE_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function reloadTestDate(): void {
  testDate.value = readTestDate();
}

/** Call when the app resumes; standalone apps can stay open across midnight. */
export function refreshRealToday(): void {
  const t = toLocalDate(new Date());
  if (t !== realToday.value) realToday.value = t;
}

/** Current timestamp; in Test Mode it lands on the simulated day (keeping the real time of day). */
export function nowISO(): string {
  const now = new Date();
  return testModeActive.value ? isoAtLocalDate(today.value, now) : now.toISOString();
}
