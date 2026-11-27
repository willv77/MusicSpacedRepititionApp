import { beforeEach, describe, expect, it } from 'vitest';
import { realToday, testModeAvailable, today } from '../src/data/clock';
import { DATA_KEY, LocalStorageRepository } from '../src/data/repository';
import {
  addTask,
  data,
  deleteSession,
  deleteTask,
  initStore,
  loadError,
  logSession,
  setTaskArchived,
  todayGroups,
  updateScheduler,
  updateSession,
} from '../src/data/store';
import { MemoryStorage } from './support/memoryStorage';

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  realToday.value = '2026-11-23';
  initStore(new LocalStorageRepository(storage));
});

describe('store', () => {
  it('ignores Test Mode outside desktop browsers', () => {
    expect(testModeAvailable).toBe(false);
    expect(today.value).toBe('2026-11-23');
  });

  it('adds a task due today and persists it', () => {
    const t = addTask('  G major scale  ');
    expect(t).toMatchObject({ description: 'G major scale', dueDate: '2026-11-23' });
    expect(addTask('   ')).toBeNull();
    const reloaded = new LocalStorageRepository(storage).load();
    expect(reloaded?.tasks).toHaveLength(1);
  });

  it('logging a session moves the due date and marks it done today', () => {
    const t = addTask('Bach')!;
    logSession({ taskId: t.id, tempo: 72, rating: 6, intervalDays: 1, recommendedDays: 1, note: ' m. 6 ' });
    expect(data.value.tasks[0].dueDate).toBe('2026-11-24');
    expect(data.value.sessions[0]).toMatchObject({ date: '2026-11-23', note: 'm. 6' });
    expect(todayGroups.value.done.map((s) => s.task.id)).toEqual([t.id]);

    realToday.value = '2026-11-26';
    expect(todayGroups.value.overdue.map((s) => s.task.id)).toEqual([t.id]);
  });

  it('editing and deleting sessions recompute the due date from the latest session', () => {
    const t = addTask('Scale')!;
    realToday.value = '2026-11-20';
    logSession({ taskId: t.id, tempo: 80, rating: 8, intervalDays: 1, recommendedDays: 1 });
    realToday.value = '2026-11-21';
    const latest = logSession({ taskId: t.id, tempo: 84, rating: 9, intervalDays: 1, recommendedDays: 1 });
    expect(data.value.tasks[0].dueDate).toBe('2026-11-22');

    updateSession(latest.id, { intervalDays: 4, note: '' });
    expect(data.value.tasks[0].dueDate).toBe('2026-11-25');
    expect(data.value.sessions.find((s) => s.id === latest.id)?.note).toBeUndefined();

    deleteSession(latest.id);
    expect(data.value.tasks[0].dueDate).toBe('2026-11-21');

    deleteSession(data.value.sessions[0].id);
    expect(data.value.tasks[0].dueDate).toBe('2026-11-21'); // no sessions left → due "today"
  });

  it('archiving hides a task from Today; deleting removes its sessions', () => {
    const t = addTask('Arpeggios')!;
    logSession({ taskId: t.id, tempo: null, rating: 7, intervalDays: 1, recommendedDays: 1 });
    setTaskArchived(t.id, true);
    expect(todayGroups.value.done).toHaveLength(0);
    setTaskArchived(t.id, false);
    expect(data.value.tasks[0].archivedAt).toBeUndefined();
    deleteTask(t.id);
    expect(data.value.tasks).toHaveLength(0);
    expect(data.value.sessions).toHaveLength(0);
  });

  it('keeps max interval ≥ min interval', () => {
    updateScheduler({ minGraduatedDays: 10, maxIntervalDays: 5 });
    expect(data.value.settings.scheduler).toMatchObject({ minGraduatedDays: 10, maxIntervalDays: 10 });
  });

  it('stores non-ASCII text as ASCII and restores it exactly', () => {
    const text = 'Für Elise — “B” section ♯ 🎵';
    addTask(text);
    const raw = storage.getItem(DATA_KEY) ?? '';
    expect(/[^\x00-\x7f]/.test(raw)).toBe(false);
    expect(new LocalStorageRepository(storage).load()?.tasks[0].description).toBe(text);
  });

  it('reports unreadable data without losing it', () => {
    storage.setItem(DATA_KEY, '{not json');
    initStore(new LocalStorageRepository(storage));
    expect(loadError.value).toBeTruthy();
    expect(data.value.tasks).toEqual([]);
    expect([...Array(storage.length).keys()].map((i) => storage.key(i)).some((k) => k?.startsWith(`${DATA_KEY}:unreadable:`))).toBe(true);
  });
});
