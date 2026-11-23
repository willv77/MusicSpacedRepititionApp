import { isLocalDate } from '../domain/dates';
import { DEFAULT_SETTINGS } from '../domain/defaults';
import type { AppData, SchedulerSettings, Session, Settings, Task, ThemeSetting } from '../domain/types';

export const CURRENT_SCHEMA_VERSION = 1;

export class DataFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DataFormatError';
  }
}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function int(v: unknown, min: number, max: number, fallback: number): number {
  return isNum(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
}

function num(v: unknown, min: number, max: number, fallback: number): number {
  return isNum(v) ? Math.min(max, Math.max(min, v)) : fallback;
}

/**
 * Upgrades older data to the current schema and validates/normalizes it.
 * Add `if (version === n) obj = migrateNToNPlus1(obj)` steps here when the schema changes.
 */
export function migrate(raw: unknown): AppData {
  if (!isObj(raw)) throw new DataFormatError('Data is not an object.');
  const version = isNum(raw.schemaVersion) ? raw.schemaVersion : 1;
  if (version > CURRENT_SCHEMA_VERSION) {
    throw new DataFormatError(`This data was made by a newer version of the app (schema ${version}). Update the app first.`);
  }
  return normalize(raw);
}

function normalize(obj: Obj): AppData {
  if (!Array.isArray(obj.tasks) || !Array.isArray(obj.sessions)) {
    throw new DataFormatError('Data is missing the tasks or sessions list.');
  }
  const tasks = obj.tasks.map(normalizeTask);
  const ids = new Set(tasks.map((t) => t.id));
  if (ids.size !== tasks.length) throw new DataFormatError('Data contains duplicate task ids.');
  const sessions = obj.sessions.map(normalizeSession).filter((s) => ids.has(s.taskId));
  return { schemaVersion: 1, tasks, sessions, settings: normalizeSettings(obj.settings) };
}

function normalizeTask(v: unknown, i: number): Task {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.description) || !isStr(v.createdAt) || !isLocalDate(v.dueDate)) {
    throw new DataFormatError(`Task #${i + 1} is invalid.`);
  }
  const task: Task = { id: v.id, description: v.description, createdAt: v.createdAt, dueDate: v.dueDate };
  if (isStr(v.archivedAt)) task.archivedAt = v.archivedAt;
  return task;
}

function normalizeSession(v: unknown, i: number): Session {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.taskId) || !isStr(v.at) || !isLocalDate(v.date) || !isNum(v.rating)) {
    throw new DataFormatError(`Session #${i + 1} is invalid.`);
  }
  const intervalDays = int(v.intervalDays, 1, 3650, 1);
  const session: Session = {
    id: v.id,
    taskId: v.taskId,
    at: v.at,
    date: v.date,
    tempo: isNum(v.tempo) && v.tempo > 0 ? Math.round(v.tempo) : null,
    rating: int(v.rating, 1, 10, 5),
    intervalDays,
    recommendedDays: int(v.recommendedDays, 1, 3650, intervalDays),
  };
  if (isStr(v.note) && v.note.trim()) session.note = v.note;
  return session;
}

function normalizeScheduler(v: unknown): SchedulerSettings {
  const d = DEFAULT_SETTINGS.scheduler;
  const o = isObj(v) ? v : {};
  const minGraduatedDays = int(o.minGraduatedDays, 1, 365, d.minGraduatedDays);
  return {
    strongRating: int(o.strongRating, 1, 10, d.strongRating),
    sessionsToGraduate: int(o.sessionsToGraduate, 1, 50, d.sessionsToGraduate),
    countOnePerDay: typeof o.countOnePerDay === 'boolean' ? o.countOnePerDay : d.countOnePerDay,
    growthAt8: num(o.growthAt8, 1, 10, d.growthAt8),
    growthAt9: num(o.growthAt9, 1, 10, d.growthAt9),
    growthAt10: num(o.growthAt10, 1, 10, d.growthAt10),
    minGraduatedDays,
    maxIntervalDays: int(o.maxIntervalDays, minGraduatedDays, 3650, Math.max(minGraduatedDays, d.maxIntervalDays)),
  };
}

function normalizeSettings(v: unknown): Settings {
  const d = DEFAULT_SETTINGS;
  const o = isObj(v) ? v : {};
  const theme: ThemeSetting = o.theme === 'light' || o.theme === 'dark' || o.theme === 'system' ? o.theme : d.theme;
  const settings: Settings = {
    scheduler: normalizeScheduler(o.scheduler),
    ratingLabel: isStr(o.ratingLabel) && o.ratingLabel.trim() ? o.ratingLabel : d.ratingLabel,
    tempoStep: int(o.tempoStep, 0, 40, d.tempoStep),
    theme,
  };
  if (isStr(o.lastBackupAt)) settings.lastBackupAt = o.lastBackupAt;
  return settings;
}
