import { computed, signal } from '@preact/signals';
import { emptyData } from '../domain/defaults';
import { buildToday, computeAllStats, dueDateFromSessions, groupSessionsByTask, type TaskStats } from '../domain/queue';
import type { AppData, SchedulerSettings, Session, Settings, Task } from '../domain/types';
import { nowISO, today } from './clock';
import type { Repository } from './repository';

let repo: Repository | null = null;

export const data = signal<AppData>(emptyData());
/** Set when stored data couldn't be read (the raw payload is preserved by the repository). */
export const loadError = signal<string | null>(null);
/** Set when the last save failed (e.g. storage full). */
export const saveError = signal<string | null>(null);

export function initStore(repository: Repository): void {
  repo = repository;
  reloadFromRepository();
}

export function reloadFromRepository(): void {
  if (!repo) return;
  try {
    data.value = repo.load() ?? emptyData();
    loadError.value = null;
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : String(err);
    data.value = emptyData();
  }
}

function commit(next: AppData): void {
  data.value = next;
  try {
    repo?.save(next);
    saveError.value = null;
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : String(err);
  }
}

export function newId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  // Fallback for non-secure contexts (e.g. testing over plain http on a LAN).
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------- Derived state ----------

export const stats = computed<TaskStats[]>(() => computeAllStats(data.value, today.value));
export const statsById = computed(() => new Map(stats.value.map((s) => [s.task.id, s])));
export const todayGroups = computed(() => buildToday(stats.value));
export const dueCount = computed(() => todayGroups.value.overdue.length + todayGroups.value.due.length);
export const settings = computed(() => data.value.settings);

// ---------- Helpers ----------

function recomputeDue(d: AppData, taskIds: Iterable<string>): AppData {
  const ids = new Set(taskIds);
  if (ids.size === 0) return d;
  const byTask = groupSessionsByTask(d.sessions.filter((s) => ids.has(s.taskId)));
  return {
    ...d,
    tasks: d.tasks.map((t) => (ids.has(t.id) ? { ...t, dueDate: dueDateFromSessions(byTask.get(t.id) ?? [], today.value) } : t)),
  };
}

// ---------- Tasks ----------

export function addTask(description: string): Task | null {
  const text = description.trim();
  if (!text) return null;
  const task: Task = { id: newId(), description: text, createdAt: nowISO(), dueDate: today.value };
  commit({ ...data.value, tasks: [...data.value.tasks, task] });
  return task;
}

export function updateTaskDescription(id: string, description: string): void {
  const text = description.trim();
  if (!text) return;
  commit({ ...data.value, tasks: data.value.tasks.map((t) => (t.id === id ? { ...t, description: text } : t)) });
}

export function setTaskArchived(id: string, archived: boolean): void {
  commit({
    ...data.value,
    tasks: data.value.tasks.map((t) => {
      if (t.id !== id) return t;
      if (archived) return { ...t, archivedAt: nowISO() };
      const { archivedAt: _removed, ...rest } = t;
      return rest;
    }),
  });
}

export function deleteTask(id: string): void {
  commit({
    ...data.value,
    tasks: data.value.tasks.filter((t) => t.id !== id),
    sessions: data.value.sessions.filter((s) => s.taskId !== id),
  });
}

// ---------- Sessions ----------

export interface LogSessionInput {
  taskId: string;
  tempo: number | null;
  rating: number;
  intervalDays: number;
  recommendedDays: number;
  note?: string;
}

export function logSession(input: LogSessionInput): Session {
  const note = input.note?.trim();
  const session: Session = {
    id: newId(),
    taskId: input.taskId,
    at: nowISO(),
    date: today.value,
    tempo: input.tempo,
    rating: input.rating,
    intervalDays: Math.max(1, Math.round(input.intervalDays)),
    recommendedDays: input.recommendedDays,
    ...(note ? { note } : {}),
  };
  commit(recomputeDue({ ...data.value, sessions: [...data.value.sessions, session] }, [input.taskId]));
  return session;
}

export type SessionPatch = Partial<Pick<Session, 'tempo' | 'rating' | 'intervalDays' | 'note'>>;

export function updateSession(id: string, patch: SessionPatch): void {
  const target = data.value.sessions.find((s) => s.id === id);
  if (!target) return;
  const sessions = data.value.sessions.map((s) => {
    if (s.id !== id) return s;
    const next: Session = { ...s, ...patch };
    if (patch.intervalDays !== undefined) next.intervalDays = Math.max(1, Math.round(patch.intervalDays));
    if ('note' in patch) {
      const note = patch.note?.trim();
      if (note) next.note = note;
      else delete next.note;
    }
    return next;
  });
  commit(recomputeDue({ ...data.value, sessions }, [target.taskId]));
}

export function deleteSession(id: string): void {
  const target = data.value.sessions.find((s) => s.id === id);
  if (!target) return;
  commit(recomputeDue({ ...data.value, sessions: data.value.sessions.filter((s) => s.id !== id) }, [target.taskId]));
}

// ---------- Settings & data management ----------

export function updateSettings(patch: Partial<Omit<Settings, 'scheduler'>>): void {
  commit({ ...data.value, settings: { ...data.value.settings, ...patch } });
}

export function updateScheduler(patch: Partial<SchedulerSettings>): void {
  const scheduler = { ...data.value.settings.scheduler, ...patch };
  if (scheduler.maxIntervalDays < scheduler.minGraduatedDays) scheduler.maxIntervalDays = scheduler.minGraduatedDays;
  commit({ ...data.value, settings: { ...data.value.settings, scheduler } });
}

export function markBackedUp(): void {
  updateSettings({ lastBackupAt: nowISO() });
}

export function replaceAllData(next: AppData): void {
  commit(next);
}

/** Removes all tasks and sessions; settings are kept. */
export function eraseTasksAndSessions(): void {
  commit({ ...data.value, tasks: [], sessions: [] });
}
