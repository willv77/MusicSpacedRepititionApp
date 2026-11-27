import { addDays, daysBetween, isoAtLocalDate } from '../../src/domain/dates';
import { DEFAULT_SETTINGS } from '../../src/domain/defaults';
import { compareSessions, dueDateFromSessions } from '../../src/domain/queue';
import { recommendInterval } from '../../src/domain/scheduler';
import type { AppData, LocalDate, Session, Settings, Task } from '../../src/domain/types';

/** Data volumes exercised by the scale tests. */
export const SCALE_LEVELS = [5, 10, 50, 100, 500, 1000, 5000, 10000] as const;

/**
 * - `tasks`: a huge task list with light history (about one session per task over the past year).
 * - `sessions`: a realistic task list (≤ 40 tasks) practiced for three years.
 * - `deep`: a single task practiced for three years.
 */
export const SHAPES = ['tasks', 'sessions', 'deep'] as const;
export type Shape = (typeof SHAPES)[number];

export interface ScaleSpec {
  tasks: number;
  sessions: number;
  /** Length of the history in days, ending on `today`. */
  days: number;
  today: LocalDate;
  seed?: number;
  settings?: Settings;
}

export function specFor(shape: Shape, n: number, today: LocalDate): ScaleSpec {
  switch (shape) {
    case 'tasks':
      return { tasks: n, sessions: n, days: 365, today };
    case 'sessions':
      return { tasks: Math.min(n, 40), sessions: n, days: 3 * 365, today };
    case 'deep':
      return { tasks: 1, sessions: n, days: 3 * 365, today };
  }
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PIECES = [
  'Bach Minuet in G',
  'Für Elise',
  'G major scale — 2 octaves',
  'Chromatic exercise 1-2-3-4',
  'Chord changes G – C – D',
  'Clair de lune',
  'Hanon No. 1',
  'Arpeggios — C, G, D major',
  'Sight-reading page',
  'Czerny Op. 599 No. 12',
];

const NOTES = ['m. 6 — use 3rd finger on the F♯', 'rushed the “B” section', 'slow practice with metronome', 'left hand voicing', 'clean at the end'];

/**
 * Deterministic practice data shaped like real use: UUID ids, unicode text, ratings that improve
 * with practice, and intervals produced by the app's own scheduler.
 */
export function buildScaleData(spec: ScaleSpec): AppData {
  const rand = mulberry32(spec.seed ?? spec.tasks * 7919 + spec.sessions);
  const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
  const uuid = () => {
    const h = Array.from({ length: 32 }, () => Math.floor(rand() * 16).toString(16));
    h[12] = '4';
    return `${h.slice(0, 8).join('')}-${h.slice(8, 12).join('')}-${h.slice(12, 16).join('')}-${h.slice(16, 20).join('')}-${h.slice(20).join('')}`;
  };
  const settings = spec.settings ?? DEFAULT_SETTINGS;
  const s = settings.scheduler;
  const firstDay = addDays(spec.today, -(spec.days - 1));

  // Skewed assignment: the first task gets the most practice, some are never practiced.
  const counts = new Array<number>(spec.tasks).fill(0);
  for (let i = 0; i < spec.sessions; i++) counts[i === 0 ? 0 : Math.floor(rand() ** 2 * spec.tasks)]++;

  const tasks: Task[] = [];
  const sessions: Session[] = [];
  counts.forEach((k, idx) => {
    const taskId = uuid();
    // The first (busiest) task covers the whole history; the others start at random points.
    const start = idx === 0 ? firstDay : addDays(firstDay, int(0, Math.max(0, spec.days - 1 - Math.min(k, 30))));
    // Most histories run up to the last few days; some stopped a while ago (overdue).
    const end = idx === 0 || rand() < 0.75 ? addDays(spec.today, -int(0, 3)) : addDays(spec.today, -int(4, 90));
    const last = end < start ? start : end;
    const span = daysBetween(start, last);
    const hasTempo = rand() < 0.7;
    const baseTempo = int(50, 90);
    const list: Session[] = [];
    for (let i = 0; i < k; i++) {
      const progress = k === 1 ? 1 : i / (k - 1);
      const date = addDays(start, Math.floor(progress * span));
      const rating = Math.min(10, Math.max(1, Math.round(4 + 5 * progress + (rand() * 4 - 2))));
      const rec = recommendInterval(list.slice(-50), { rating, date }, s);
      const intervalDays = rand() < 0.1 ? rec.days + int(1, 3) : rec.days;
      const note = rand() < 0.08 ? NOTES[int(0, NOTES.length - 1)] : undefined;
      list.push({
        id: uuid(),
        taskId,
        at: isoAtLocalDate(date, new Date(2000, 0, 1, 7 + (i % 14), (i * 7 + idx) % 60, i % 60)),
        date,
        tempo: hasTempo ? baseTempo + Math.round(progress * 60) + int(-2, 2) : null,
        rating,
        intervalDays,
        recommendedDays: rec.days,
        ...(note ? { note } : {}),
      });
    }
    list.sort(compareSessions);
    const piece = PIECES[idx % PIECES.length];
    const task: Task = {
      id: taskId,
      description: `${piece} — mm. ${(idx % 90) + 1}–${(idx % 90) + 9} (#${idx + 1})`,
      createdAt: isoAtLocalDate(start, new Date(2000, 0, 1, 6, idx % 60)),
      dueDate: dueDateFromSessions(list, start),
    };
    if (spec.tasks >= 10 && rand() < 0.1) task.archivedAt = isoAtLocalDate(spec.today, new Date(2000, 0, 1, 5, 0));
    tasks.push(task);
    sessions.push(...list);
  });

  sessions.sort(compareSessions);
  return { schemaVersion: 1, tasks, sessions, settings };
}
