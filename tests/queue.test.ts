import { describe, expect, it } from 'vitest';
import { emptyData } from '../src/domain/defaults';
import { buildToday, computeAllStats, dueDateFromSessions, practiceStreak } from '../src/domain/queue';
import { buildSampleData } from '../src/domain/sample';
import { recommendInterval } from '../src/domain/scheduler';
import type { AppData, Session, Task } from '../src/domain/types';

const TODAY = '2026-11-23';

function task(id: string, dueDate: string, extra: Partial<Task> = {}): Task {
  return { id, description: id, createdAt: '2026-11-01T10:00:00.000Z', dueDate, ...extra };
}

function sess(taskId: string, date: string, rating = 8, intervalDays = 1): Session {
  return { id: `${taskId}-${date}-${rating}`, taskId, at: `${date}T18:00:00.000Z`, date, tempo: 80, rating, intervalDays, recommendedDays: intervalDays };
}

function data(tasks: Task[], sessions: Session[]): AppData {
  return { ...emptyData(), tasks, sessions };
}

describe('buildToday', () => {
  it('groups tasks into overdue, due, done and upcoming', () => {
    const d = data(
      [
        task('late2', '2026-11-21'),
        task('late1', '2026-11-22'),
        task('due', TODAY),
        task('done', '2026-11-24'),
        task('soon', '2026-11-25'),
        task('archived', '2026-11-20', { archivedAt: '2026-11-21T00:00:00.000Z' }),
      ],
      [sess('late2', '2026-11-20'), sess('late1', '2026-11-21'), sess('due', '2026-11-22'), sess('done', TODAY), sess('soon', '2026-11-20', 9, 5)],
    );
    const g = buildToday(computeAllStats(d, TODAY));
    expect(g.overdue.map((s) => s.task.id)).toEqual(['late2', 'late1']);
    expect(g.due.map((s) => s.task.id)).toEqual(['due']);
    expect(g.done.map((s) => s.task.id)).toEqual(['done']);
    expect(g.upcoming.map((s) => s.task.id)).toEqual(['soon']);
  });

  it('orders overdue tasks by lateness relative to their interval', () => {
    const d = data(
      [task('long', '2026-11-20'), task('short', '2026-11-21')],
      [sess('long', '2026-10-21', 9, 30), sess('short', '2026-11-20', 8, 1)],
    );
    const g = buildToday(computeAllStats(d, TODAY));
    // 'short' is 2 days late on a 1-day interval; 'long' is 3 days late on a 30-day interval.
    expect(g.overdue.map((s) => s.task.id)).toEqual(['short', 'long']);
  });

  it('puts learning tasks before graduated ones in Due today', () => {
    const grad = ['2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18'].map((dt) => sess('grad', dt, 9));
    grad[4].intervalDays = 5;
    const d = data([task('grad', TODAY), task('learn', TODAY, { createdAt: '2026-11-05T00:00:00.000Z' })], [...grad, sess('learn', '2026-11-22')]);
    const g = buildToday(computeAllStats(d, TODAY));
    expect(g.due.map((s) => s.task.id)).toEqual(['learn', 'grad']);
  });
});

describe('helpers', () => {
  it('derives the due date from the latest session', () => {
    expect(dueDateFromSessions([sess('a', '2026-11-20', 8, 1), sess('a', '2026-11-21', 9, 3)], TODAY)).toBe('2026-11-24');
    expect(dueDateFromSessions([], TODAY)).toBe(TODAY);
  });

  it('computes the practice-day streak', () => {
    const list = [sess('a', '2026-11-20'), sess('a', '2026-11-21'), sess('b', '2026-11-22'), sess('a', '2026-11-22')];
    expect(practiceStreak(list, TODAY)).toBe(3); // nothing yet today → counts back from yesterday
    expect(practiceStreak([...list, sess('a', TODAY)], TODAY)).toBe(4);
    expect(practiceStreak(list, '2026-11-25')).toBe(0);
  });
});

describe('buildSampleData', () => {
  it('creates tasks in every Today group, consistent with the scheduler', () => {
    let n = 0;
    const sample = buildSampleData(TODAY, () => `id${++n}`);
    const g = buildToday(computeAllStats(sample, TODAY), 10);
    expect(g.overdue.map((s) => s.task.description)).toEqual(['Bach Minuet in G — mm. 1–8']);
    expect(g.overdue[0].daysUntilDue).toBe(-2);
    expect(g.done.map((s) => s.task.description)).toEqual(['Für Elise — B section']);
    expect(g.due).toHaveLength(4);
    expect(g.upcoming.map((s) => [s.task.description, s.daysUntilDue])).toEqual([
      ['Sight-read 1 new page', 1],
      ['Ear training: intervals', 3],
    ]);

    // Every sample session's interval equals what the scheduler recommends for that history.
    const byTask = new Map<string, Session[]>();
    for (const s of sample.sessions) byTask.set(s.taskId, [...(byTask.get(s.taskId) ?? []), s]);
    for (const list of byTask.values()) {
      list.forEach((s, i) => {
        expect(recommendInterval(list.slice(0, i), { rating: s.rating, date: s.date }, sample.settings.scheduler).days).toBe(s.intervalDays);
      });
    }
  });
});
