import { describe, expect, it } from 'vitest';
import { addDays } from '../src/domain/dates';
import { DEFAULT_SCHEDULER, recommendInterval, strongStreak, suggestTempo } from '../src/domain/scheduler';
import type { SchedulerSettings, Session } from '../src/domain/types';

const S = DEFAULT_SCHEDULER;
let seq = 0;

function session(date: string, rating: number, intervalDays = 1, tempo: number | null = null): Session {
  seq++;
  return { id: `s${seq}`, taskId: 't', at: `${date}T18:00:${String(seq % 60).padStart(2, '0')}.000Z`, date, tempo, rating, intervalDays, recommendedDays: intervalDays };
}

/** Logs sessions one after another, each on the given date, accepting the recommendation. */
function simulate(steps: [string, number][], s: SchedulerSettings = S) {
  const history: Session[] = [];
  return steps.map(([date, rating]) => {
    const rec = recommendInterval(history, { rating, date }, s);
    history.push(session(date, rating, rec.days));
    return rec;
  });
}

describe('strongStreak (consecutive)', () => {
  it('counts only the most recent unbroken run of strong sessions', () => {
    const list = [session('2026-11-01', 9), session('2026-11-02', 9), session('2026-11-03', 7), session('2026-11-04', 8), session('2026-11-05', 10)];
    expect(strongStreak(list, S)).toBe(2);
  });

  it('is zero when the latest session is below the threshold', () => {
    expect(strongStreak([session('2026-11-01', 9), session('2026-11-02', 7)], S)).toBe(0);
  });

  it('counts several strong sessions on the same day once when countOnePerDay is on', () => {
    const list = [session('2026-11-01', 8), session('2026-11-02', 9), session('2026-11-02', 10)];
    expect(strongStreak(list, S)).toBe(2);
    expect(strongStreak(list, { ...S, countOnePerDay: false })).toBe(3);
  });

  it('respects a custom strong threshold', () => {
    const list = [session('2026-11-01', 7), session('2026-11-02', 7)];
    expect(strongStreak(list, { ...S, strongRating: 7 })).toBe(2);
  });
});

describe('recommendInterval', () => {
  it('recommends 1 day until there are 5 consecutive sessions at 8+', () => {
    const recs = simulate([
      ['2026-11-01', 8],
      ['2026-11-02', 9],
      ['2026-11-03', 8],
      ['2026-11-04', 10],
    ]);
    expect(recs.map((r) => r.days)).toEqual([1, 1, 1, 1]);
    expect(recs.map((r) => r.streak)).toEqual([1, 2, 3, 4]);
    expect(recs.every((r) => r.reason === 'learning')).toBe(true);
  });

  it('a rating below 8 resets the streak, so 5 non-consecutive 8+ sessions do not graduate', () => {
    const recs = simulate([
      ['2026-11-01', 8],
      ['2026-11-02', 8],
      ['2026-11-03', 8],
      ['2026-11-04', 8],
      ['2026-11-05', 7],
      ['2026-11-06', 9],
    ]);
    expect(recs.map((r) => r.days)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(recs[4]).toMatchObject({ reason: 'learning', streak: 0, previousStreak: 4 });
    expect(recs[5].streak).toBe(1);
  });

  it('follows the worked example from the design doc', () => {
    const recs = simulate([
      ['2026-11-01', 6],
      ['2026-11-02', 8],
      ['2026-11-03', 7],
      ['2026-11-04', 9],
      ['2026-11-05', 8],
      ['2026-11-06', 8],
      ['2026-11-07', 10],
      ['2026-11-08', 9], // 5th consecutive → graduated: 1 × 2 = 2
      ['2026-11-10', 8], // 2 × 1.5 = 3
      ['2026-11-13', 10], // 3 × 2.5 = 7.5 → 8
      ['2026-11-21', 7], // breaks streak → back to daily
      ['2026-11-22', 9],
    ]);
    expect(recs.map((r) => r.days)).toEqual([1, 1, 1, 1, 1, 1, 1, 2, 3, 8, 1, 1]);
    expect(recs.map((r) => r.reason)).toEqual([
      'learning',
      'learning',
      'learning',
      'learning',
      'learning',
      'learning',
      'learning',
      'graduated',
      'growing',
      'growing',
      'reset',
      'learning',
    ]);
  });

  it('grows from the actual gap when practiced late', () => {
    const history = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'].map((d) => session(d, 9));
    history[4].intervalDays = 2;
    // Due Nov 7, practiced Nov 10 → base 5 days × 2 (rated 9) = 10
    expect(recommendInterval(history, { rating: 9, date: '2026-11-10' }, S)).toMatchObject({ days: 10, baseDays: 5, reason: 'growing' });
  });

  it('uses the previous interval as the base for a second session on the same day', () => {
    const history = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'].map((d) => session(d, 9));
    history[4].intervalDays = 6;
    expect(recommendInterval(history, { rating: 8, date: '2026-11-05' }, S)).toMatchObject({ days: 9, baseDays: 6 });
  });

  it('clamps to the configured min and max', () => {
    const history = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04'].map((d) => session(d, 8));
    // graduating with rating 8: 1 × 1.5 = 1.5 → 2, then clamped to min 3
    expect(recommendInterval(history, { rating: 8, date: '2026-11-05' }, { ...S, minGraduatedDays: 3 }).days).toBe(3);

    const long = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05'].map((d) => session(d, 10));
    expect(recommendInterval(long, { rating: 10, date: addDays('2026-01-05', 40) }, S).days).toBe(60);
  });

  it('graduates immediately when only 1 strong session is required', () => {
    expect(recommendInterval([], { rating: 9, date: '2026-11-01' }, { ...S, sessionsToGraduate: 1 })).toMatchObject({ reason: 'graduated', days: 2 });
  });
});

describe('suggestTempo', () => {
  it('adds the step after a strong session', () => {
    expect(suggestTempo([session('2026-11-01', 8, 1, 96)], S, 4)).toBe(100);
  });

  it('keeps the tempo after a 6–7 and backs off 5% after ≤ 5', () => {
    expect(suggestTempo([session('2026-11-01', 7, 1, 96)], S, 4)).toBe(96);
    expect(suggestTempo([session('2026-11-01', 5, 1, 100)], S, 4)).toBe(95);
  });

  it('uses the latest session that has a tempo, or null if none', () => {
    expect(suggestTempo([session('2026-11-01', 9, 1, 80), session('2026-11-02', 9, 1, null)], S, 4)).toBe(84);
    expect(suggestTempo([session('2026-11-01', 9)], S, 4)).toBeNull();
  });
});
