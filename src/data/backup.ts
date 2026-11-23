import { dueDateFromSessions, groupSessionsByTask } from '../domain/queue';
import type { AppData, LocalDate } from '../domain/types';
import { DataFormatError, migrate } from './migrations';

export const BACKUP_APP_ID = 'wkv-practice';

export function serializeBackup(d: AppData, exportedAt: string): string {
  return JSON.stringify({ app: BACKUP_APP_ID, exportedAt, ...d }, null, 2);
}

export function parseBackup(text: string): AppData {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new DataFormatError('The file is not valid JSON.');
  }
  if (typeof raw !== 'object' || raw === null || (raw as { app?: unknown }).app !== BACKUP_APP_ID) {
    throw new DataFormatError('This is not a Practice backup file.');
  }
  return migrate(raw);
}

/**
 * Union of both data sets by id (existing items win on conflict), with due dates recomputed
 * from the merged session history. Current settings are kept.
 */
export function mergeData(current: AppData, incoming: AppData): AppData {
  const tasks = new Map(current.tasks.map((t) => [t.id, t]));
  for (const t of incoming.tasks) if (!tasks.has(t.id)) tasks.set(t.id, t);
  const sessions = new Map(current.sessions.map((s) => [s.id, s]));
  for (const s of incoming.sessions) if (!sessions.has(s.id) && tasks.has(s.taskId)) sessions.set(s.id, s);

  const mergedSessions = [...sessions.values()];
  const byTask = groupSessionsByTask(mergedSessions);
  return {
    ...current,
    tasks: [...tasks.values()].map((t) => {
      const list = byTask.get(t.id);
      return list?.length ? { ...t, dueDate: dueDateFromSessions(list, t.dueDate) } : t;
    }),
    sessions: mergedSessions,
  };
}

export function backupFileName(today: LocalDate): string {
  return `practice-backup-${today}.json`;
}

export type DeliveryResult = 'shared' | 'downloaded' | 'cancelled';

/** iOS: opens the share sheet (save to Files/iCloud Drive). Desktop: downloads the file. */
export async function deliverBackup(json: string, filename: string, preferShare: boolean): Promise<DeliveryResult> {
  const file = new File([json], filename, { type: 'application/json' });
  if (preferShare && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Practice backup' });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'downloaded';
}
