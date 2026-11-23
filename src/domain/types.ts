/** ISO-8601 timestamp, e.g. '2026-11-23T15:04:05.000Z'. */
export type ISODateTime = string;
/** Device-local calendar day, e.g. '2026-11-23'. Used for all scheduling. */
export type LocalDate = string;

export interface Task {
  id: string;
  description: string;
  createdAt: ISODateTime;
  /** Cached next-practice day; recomputed whenever the task's sessions change. */
  dueDate: LocalDate;
  archivedAt?: ISODateTime;
}

export interface Session {
  id: string;
  taskId: string;
  at: ISODateTime;
  /** Calendar day the session counts for. */
  date: LocalDate;
  /** BPM, or null when tempo doesn't apply. */
  tempo: number | null;
  /** 1–10, higher = better (10 = effortless). */
  rating: number;
  /** Days until next practice that the user chose. */
  intervalDays: number;
  /** Days the app recommended at the time of logging. */
  recommendedDays: number;
  note?: string;
}

export interface SchedulerSettings {
  /** A session rated at or above this is "strong". */
  strongRating: number;
  /** Consecutive strong sessions needed before intervals start growing. */
  sessionsToGraduate: number;
  /** Several strong sessions on the same day count once toward the streak. */
  countOnePerDay: boolean;
  growthAt8: number;
  growthAt9: number;
  growthAt10: number;
  minGraduatedDays: number;
  maxIntervalDays: number;
}

export type ThemeSetting = 'system' | 'light' | 'dark';

export interface Settings {
  scheduler: SchedulerSettings;
  ratingLabel: string;
  /** BPM added to the suggested tempo after a strong session. */
  tempoStep: number;
  theme: ThemeSetting;
  lastBackupAt?: ISODateTime;
}

export interface AppData {
  schemaVersion: 1;
  tasks: Task[];
  sessions: Session[];
  settings: Settings;
}
