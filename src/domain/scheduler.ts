import { daysBetween } from './dates';
import type { LocalDate, SchedulerSettings, Session } from './types';

export const DEFAULT_SCHEDULER: SchedulerSettings = {
  strongRating: 8,
  sessionsToGraduate: 5,
  countOnePerDay: true,
  growthAt8: 1.5,
  growthAt9: 2,
  growthAt10: 2.5,
  minGraduatedDays: 2,
  maxIntervalDays: 60,
};

type Rated = Pick<Session, 'rating' | 'date'>;

/**
 * Number of most-recent consecutive strong sessions. Input must be ordered oldest → newest.
 * Any session rated below `strongRating` breaks the streak.
 */
export function strongStreak(sessions: readonly Rated[], s: SchedulerSettings): number {
  let count = 0;
  let lastCountedDate: LocalDate | null = null;
  for (let i = sessions.length - 1; i >= 0; i--) {
    const x = sessions[i];
    if (x.rating < s.strongRating) break;
    if (s.countOnePerDay && x.date === lastCountedDate) continue;
    count++;
    lastCountedDate = x.date;
  }
  return count;
}

export type RecommendationReason =
  /** Fewer than N consecutive strong sessions → practice tomorrow. */
  | 'learning'
  /** Was graduated, but this session broke the streak → back to daily. */
  | 'reset'
  /** This session completes the streak → first growing interval. */
  | 'graduated'
  /** Already graduated and still strong → interval grows. */
  | 'growing';

export interface Recommendation {
  days: number;
  reason: RecommendationReason;
  /** Streak including the session being logged. */
  streak: number;
  /** Streak before the session being logged. */
  previousStreak: number;
  factor?: number;
  baseDays?: number;
}

export function growthFactor(rating: number, s: SchedulerSettings): number {
  if (rating >= 10) return s.growthAt10;
  if (rating >= 9) return s.growthAt9;
  return s.growthAt8;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), Math.max(min, max));
}

/**
 * Recommended days until next practice.
 * Rule: 1 day until the task has `sessionsToGraduate` consecutive sessions rated ≥ `strongRating`;
 * after that, the gap since the previous session is multiplied by a growth factor based on the rating.
 */
export function recommendInterval(
  history: readonly Session[],
  draft: { rating: number; date: LocalDate },
  s: SchedulerSettings,
): Recommendation {
  const goal = s.sessionsToGraduate;
  const previousStreak = strongStreak(history, s);
  const streak = strongStreak([...history, draft], s);

  if (streak < goal) {
    const reason = draft.rating < s.strongRating && previousStreak >= goal ? 'reset' : 'learning';
    return { days: 1, reason, streak, previousStreak };
  }

  const prev = history.at(-1);
  const elapsed = prev ? daysBetween(prev.date, draft.date) : 1;
  const baseDays = elapsed >= 1 ? elapsed : Math.max(1, prev?.intervalDays ?? 1);
  const factor = growthFactor(draft.rating, s);
  const days = clamp(Math.round(baseDays * factor), s.minGraduatedDays, s.maxIntervalDays);
  return { days, reason: previousStreak < goal ? 'graduated' : 'growing', streak, previousStreak, factor, baseDays };
}

/**
 * Tempo to prefill for the next session, based on the most recent session that has a tempo:
 * strong → +step BPM, rated ≤ 5 → −5%, otherwise the same tempo.
 */
export function suggestTempo(history: readonly Session[], s: SchedulerSettings, step: number): number | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const x = history[i];
    if (x.tempo == null) continue;
    if (x.rating >= s.strongRating) return x.tempo + step;
    if (x.rating <= 5) return Math.max(1, Math.round(x.tempo * 0.95));
    return x.tempo;
  }
  return null;
}
