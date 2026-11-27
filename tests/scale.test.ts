import { beforeAll, describe, expect, it } from 'vitest';
import { mergeData, parseBackup, serializeBackup } from '../src/data/backup';
import { realToday } from '../src/data/clock';
import { migrate } from '../src/data/migrations';
import { DATA_KEY, LocalStorageRepository, toStorageJSON } from '../src/data/repository';
import {
  addTask,
  data,
  deleteSession,
  deleteTask,
  initStore,
  loadError,
  logSession,
  saveError,
  setTaskArchived,
  stats,
  todayGroups,
  updateSession,
} from '../src/data/store';
import { addDays, daysBetween } from '../src/domain/dates';
import { buildToday, compareSessions, computeAllStats, practiceStreak } from '../src/domain/queue';
import { recommendInterval } from '../src/domain/scheduler';
import type { AppData, Task } from '../src/domain/types';
import { MemoryStorage, WEBKIT_QUOTA_BYTES } from './support/memoryStorage';
import { buildScaleData, SCALE_LEVELS, SHAPES, specFor } from './support/scaleData';

const TODAY = '2026-11-23';

/** Generous wall-clock budget (ms) that still catches accidentally quadratic work at 10 000 items. */
const budget = (n: number) => 150 + n * 0.1;

function timed<T>(fn: () => T): { result: T; ms: number } {
  const t0 = performance.now();
  const result = fn();
  return { result, ms: performance.now() - t0 };
}

function subset(d: AppData, tasks: Task[]): AppData {
  const ids = new Set(tasks.map((t) => t.id));
  return { ...d, tasks, sessions: d.sessions.filter((s) => ids.has(s.taskId)) };
}

describe.each(SHAPES)('scale: %s', (shape) => {
  describe.each(SCALE_LEVELS)('n = %i', (n) => {
    const spec = specFor(shape, n, TODAY);
    let d: AppData;
    beforeAll(() => {
      d = buildScaleData(spec);
    });

    it('validates a history spanning the whole period', () => {
      expect(d.tasks).toHaveLength(spec.tasks);
      expect(d.sessions).toHaveLength(spec.sessions);
      expect(d.sessions[0].date).toBe(addDays(TODAY, -(spec.days - 1)));
      expect(daysBetween(d.sessions.at(-1)!.date, TODAY)).toBeLessThanOrEqual(3);

      const { result, ms } = timed(() => migrate(JSON.parse(JSON.stringify(d))));
      expect(result).toEqual(d);
      expect(ms).toBeLessThan(budget(n));
    });

    it('derives task stats, recommendations and the Today queue consistently', () => {
      const { result: all, ms } = timed(() => computeAllStats(d, TODAY));
      expect(ms).toBeLessThan(budget(n));
      expect(all.reduce((sum, st) => sum + st.sessions.length, 0)).toBe(n);

      const s = d.settings.scheduler;
      for (const st of all) {
        expect(st.sessions.every((x, i, arr) => x.taskId === st.task.id && (i === 0 || compareSessions(arr[i - 1], x) <= 0))).toBe(true);
        expect(st.graduated).toBe(st.streak >= s.sessionsToGraduate);
        expect(st.daysUntilDue).toBe(daysBetween(TODAY, st.task.dueDate));
      }

      // The Log Session sheet recommends from the full history of the busiest task.
      const busiest = all.reduce((a, b) => (b.sessions.length > a.sessions.length ? b : a));
      for (const rating of [1, 8, 10]) {
        const rec = timed(() => recommendInterval(busiest.sessions, { rating, date: TODAY }, s));
        expect(rec.result.days).toBeGreaterThanOrEqual(1);
        expect(rec.result.days).toBeLessThanOrEqual(s.maxIntervalDays);
        expect(rec.ms).toBeLessThan(budget(n));
      }

      const g = timed(() => buildToday(all));
      expect(g.ms).toBeLessThan(budget(n));
      const { overdue, due, done, upcoming } = g.result;
      const active = all.filter((st) => !st.task.archivedAt);
      const later = active.filter((st) => !st.doneToday && st.daysUntilDue > 0);
      const listed = [...overdue, ...due, ...done];
      expect(new Set(listed.map((st) => st.task.id)).size).toBe(listed.length);
      expect(listed.length + later.length).toBe(active.length);
      expect(overdue.every((st) => st.daysUntilDue < 0 && !st.doneToday)).toBe(true);
      expect(due.every((st) => st.daysUntilDue === 0 && !st.doneToday)).toBe(true);
      expect(done.every((st) => st.doneToday && !st.task.archivedAt)).toBe(true);
      expect(upcoming).toHaveLength(Math.min(5, later.length));
      expect(upcoming.map((st) => st.daysUntilDue)).toEqual(later.map((st) => st.daysUntilDue).sort((a, b) => a - b).slice(0, 5));

      const streak = timed(() => practiceStreak(d.sessions, TODAY));
      expect(streak.result).toBeGreaterThanOrEqual(0);
      expect(streak.result).toBeLessThanOrEqual(spec.days);
      expect(streak.ms).toBeLessThan(budget(n));
    });

    it('logs, edits, archives and deletes with correct due dates and saves within the iPhone quota', () => {
      const storage = new MemoryStorage(WEBKIT_QUOTA_BYTES);
      storage.setItem(DATA_KEY, toStorageJSON(d));
      realToday.value = TODAY;
      saveError.value = null;
      const ops: Record<string, number> = {};
      const op = <T>(name: string, fn: () => T): T => {
        const r = timed(fn);
        ops[name] = r.ms;
        expect(saveError.value, name).toBeNull();
        return r.result;
      };

      op('load', () => initStore(new LocalStorageRepository(storage)));
      expect(loadError.value).toBeNull();
      expect(data.value.sessions).toHaveLength(n);

      const target = stats.value.filter((st) => !st.task.archivedAt).reduce((a, b) => (b.sessions.length > a.sessions.length ? b : a));
      const id = target.task.id;
      const sessionCount = target.sessions.length;
      const previousDue = target.task.dueDate;
      const task = () => data.value.tasks.find((t) => t.id === id);

      const logged = op('logSession', () => logSession({ taskId: id, tempo: 100, rating: 9, intervalDays: 3, recommendedDays: 3, note: 'scale — test' }));
      expect(task()?.dueDate).toBe(addDays(TODAY, 3));
      expect(todayGroups.value.done.some((st) => st.task.id === id)).toBe(true);

      op('updateSession', () => updateSession(target.sessions[0].id, { rating: 1, note: 'edited “old” session' }));
      expect(task()?.dueDate).toBe(addDays(TODAY, 3));

      op('deleteSession', () => deleteSession(logged.id));
      expect(task()?.dueDate).toBe(previousDue);

      op('archive', () => setTaskArchived(id, true));
      const groups = todayGroups.value;
      expect([...groups.overdue, ...groups.due, ...groups.done, ...groups.upcoming].some((st) => st.task.id === id)).toBe(false);
      op('unarchive', () => setTaskArchived(id, false));

      const added = op('addTask', () => addTask('New piece — mm. 1–4'));
      expect(todayGroups.value.due.some((st) => st.task.id === added?.id)).toBe(true);

      op('deleteTask', () => deleteTask(id));
      expect(data.value.sessions).toHaveLength(n - sessionCount);
      expect(data.value.sessions.some((s) => s.taskId === id)).toBe(false);

      expect(new LocalStorageRepository(storage).load()).toEqual(data.value);
      for (const [name, ms] of Object.entries(ops)) expect(ms, name).toBeLessThan(budget(n));
    });

    it('round-trips backups and merges data from two devices', () => {
      const exported = timed(() => parseBackup(serializeBackup(d, `${TODAY}T20:00:00.000Z`)));
      expect(exported.result).toEqual(d);
      expect(exported.ms).toBeLessThan(budget(n));

      const half = Math.ceil(d.tasks.length / 2);
      const merged = timed(() => mergeData(subset(d, d.tasks.slice(0, half)), subset(d, d.tasks.slice(half))));
      expect(merged.ms).toBeLessThan(budget(n));
      expect(merged.result.tasks.map((t) => [t.id, t.dueDate])).toEqual(d.tasks.map((t) => [t.id, t.dueDate]));
      expect(merged.result.sessions).toHaveLength(n);

      const again = mergeData(d, d);
      expect(again.tasks).toHaveLength(d.tasks.length);
      expect(again.sessions).toHaveLength(n);
    });
  });
});
