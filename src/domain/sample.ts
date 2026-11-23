import { addDays, daysBetween, isoAtLocalDate } from './dates';
import { DEFAULT_SETTINGS } from './defaults';
import { dueDateFromSessions } from './queue';
import { recommendInterval } from './scheduler';
import type { AppData, LocalDate, SchedulerSettings, Session, Settings, Task } from './types';

interface SampleSpec {
  description: string;
  ratings: number[];
  tempos?: (number | null)[];
  /** Extra days practiced late after session i (before session i + 1). */
  delays?: number[];
  /** Align so the next due date lands this many days from today… */
  dueOffset?: number;
  /** …or so the last session lands this many days from today. */
  lastSessionOffset?: number;
  notes?: Record<number, string>;
}

const SPECS: SampleSpec[] = [
  {
    description: 'Bach Minuet in G — mm. 1–8',
    ratings: [4, 5, 5, 6, 5, 6, 7, 6, 5, 7, 8, 6],
    tempos: [60, 60, 62, 62, 64, 64, 66, 66, 68, 68, 70, 72],
    delays: [0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    dueOffset: -2,
    notes: { 11: 'm. 6 — use 3rd finger on the F♯' },
  },
  {
    description: 'G major scale — 2 octaves, hands together',
    ratings: [5, 6, 6, 8, 7, 9, 8],
    tempos: [80, 84, 84, 88, 92, 92, 96],
    dueOffset: 0,
  },
  {
    description: 'Chromatic exercise 1-2-3-4',
    ratings: [6, 7, 8, 8, 9, 8, 9, 9, 8],
    tempos: [92, 96, 100, 100, 104, 108, 112, 112, 116],
    dueOffset: 0,
  },
  {
    description: 'Chord changes G – C – D',
    ratings: [5, 6, 8, 7, 8, 8],
    tempos: [60, 64, 68, 72, 76, 80],
    dueOffset: 0,
  },
  {
    description: 'Für Elise — B section',
    ratings: [6, 7, 8, 8],
    tempos: [56, 58, 60, 62],
    lastSessionOffset: 0,
  },
  { description: 'Ear training: intervals', ratings: [8, 9, 8, 9, 9, 10, 9], dueOffset: 3 },
  { description: 'Sight-read 1 new page', ratings: [7, 8, 8, 9, 9, 8], dueOffset: 1 },
  { description: 'Arpeggios — C, G, D major', ratings: [] },
];

function simulate(spec: SampleSpec, taskId: string, s: SchedulerSettings, newId: () => string): Session[] {
  const sessions: Session[] = [];
  let date: LocalDate = '2000-01-01';
  spec.ratings.forEach((rating, i) => {
    const prev = sessions.at(-1);
    if (prev) date = addDays(prev.date, prev.intervalDays + (spec.delays?.[i - 1] ?? 0));
    const rec = recommendInterval(sessions, { rating, date }, s);
    sessions.push({
      id: newId(),
      taskId,
      at: '',
      date,
      tempo: spec.tempos?.[i] ?? null,
      rating,
      intervalDays: rec.days,
      recommendedDays: rec.days,
      ...(spec.notes?.[i] ? { note: spec.notes[i] } : {}),
    });
  });
  return sessions;
}

/** Realistic demo data relative to `today` (used by Test Mode). Keeps the given settings. */
export function buildSampleData(today: LocalDate, newId: () => string, settings: Settings = DEFAULT_SETTINGS): AppData {
  const tasks: Task[] = [];
  const sessions: Session[] = [];

  SPECS.forEach((spec, idx) => {
    const taskId = newId();
    const raw = simulate(spec, taskId, settings.scheduler, newId);
    let shift = 0;
    const last = raw.at(-1);
    if (last) {
      const computedDue = dueDateFromSessions(raw, today);
      shift =
        spec.lastSessionOffset !== undefined
          ? daysBetween(last.date, addDays(today, spec.lastSessionOffset))
          : daysBetween(computedDue, addDays(today, spec.dueOffset ?? 0));
    }
    const shifted = raw.map((x, i) => {
      const date = addDays(x.date, shift);
      const time = new Date(2000, 0, 1, 18, 5 + ((i * 7 + idx * 3) % 50));
      return { ...x, date, at: isoAtLocalDate(date, time) };
    });
    const createdDate = shifted[0]?.date ?? today;
    tasks.push({
      id: taskId,
      description: spec.description,
      createdAt: isoAtLocalDate(createdDate, new Date(2000, 0, 1, 17, idx)),
      dueDate: dueDateFromSessions(shifted, today),
    });
    sessions.push(...shifted);
  });

  return { schemaVersion: 1, tasks, sessions, settings };
}
