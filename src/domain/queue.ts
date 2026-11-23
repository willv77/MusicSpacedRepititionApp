import { addDays, daysBetween } from './dates';
import { strongStreak } from './scheduler';
import type { AppData, LocalDate, SchedulerSettings, Session, Task } from './types';

export interface TaskStats {
  task: Task;
  /** Oldest → newest. */
  sessions: Session[];
  last?: Session;
  streak: number;
  graduated: boolean;
  lastTempo: number | null;
  bestTempo: number | null;
  doneToday: boolean;
  /** dueDate − today (negative when overdue). */
  daysUntilDue: number;
}

export function compareSessions(a: Session, b: Session): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return a.at < b.at ? -1 : a.at > b.at ? 1 : 0;
}

export function sortSessions(sessions: readonly Session[]): Session[] {
  return [...sessions].sort(compareSessions);
}

export function groupSessionsByTask(sessions: readonly Session[]): Map<string, Session[]> {
  const map = new Map<string, Session[]>();
  for (const s of sortSessions(sessions)) {
    const list = map.get(s.taskId);
    if (list) list.push(s);
    else map.set(s.taskId, [s]);
  }
  return map;
}

/** Next practice day implied by the latest session, or `fallback` if there are none. */
export function dueDateFromSessions(sortedSessions: readonly Session[], fallback: LocalDate): LocalDate {
  const last = sortedSessions.at(-1);
  return last ? addDays(last.date, last.intervalDays) : fallback;
}

export function computeStats(task: Task, sortedSessions: Session[], today: LocalDate, s: SchedulerSettings): TaskStats {
  const last = sortedSessions.at(-1);
  const streak = strongStreak(sortedSessions, s);
  let lastTempo: number | null = null;
  let bestTempo: number | null = null;
  for (const x of sortedSessions) {
    if (x.tempo == null) continue;
    lastTempo = x.tempo;
    bestTempo = bestTempo == null ? x.tempo : Math.max(bestTempo, x.tempo);
  }
  return {
    task,
    sessions: sortedSessions,
    last,
    streak,
    graduated: streak >= s.sessionsToGraduate,
    lastTempo,
    bestTempo,
    doneToday: sortedSessions.some((x) => x.date === today),
    daysUntilDue: daysBetween(today, task.dueDate),
  };
}

export function computeAllStats(data: AppData, today: LocalDate): TaskStats[] {
  const byTask = groupSessionsByTask(data.sessions);
  return data.tasks.map((t) => computeStats(t, byTask.get(t.id) ?? [], today, data.settings.scheduler));
}

export interface TodayGroups {
  overdue: TaskStats[];
  due: TaskStats[];
  done: TaskStats[];
  upcoming: TaskStats[];
}

function urgency(st: TaskStats): number {
  return -st.daysUntilDue / Math.max(1, st.last?.intervalDays ?? 1);
}

export function buildToday(stats: readonly TaskStats[], upcomingLimit = 5): TodayGroups {
  const active = stats.filter((st) => !st.task.archivedAt);
  const done = active.filter((st) => st.doneToday).sort((a, b) => (b.last?.at ?? '').localeCompare(a.last?.at ?? ''));
  const pending = active.filter((st) => !st.doneToday);
  const overdue = pending
    .filter((st) => st.daysUntilDue < 0)
    .sort((a, b) => urgency(b) - urgency(a) || a.daysUntilDue - b.daysUntilDue);
  const due = pending
    .filter((st) => st.daysUntilDue === 0)
    .sort((a, b) => Number(a.graduated) - Number(b.graduated) || a.task.createdAt.localeCompare(b.task.createdAt));
  const upcoming = pending
    .filter((st) => st.daysUntilDue > 0)
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue || a.task.description.localeCompare(b.task.description))
    .slice(0, upcomingLimit);
  return { overdue, due, done, upcoming };
}

/** Consecutive days with at least one session, ending today (or yesterday if nothing logged yet today). */
export function practiceStreak(sessions: readonly Session[], today: LocalDate): number {
  const days = new Set(sessions.map((x) => x.date));
  let d = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}
