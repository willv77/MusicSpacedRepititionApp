import { describe, expect, it } from 'vitest';
import { emptyData } from '../src/domain/defaults';
import { mergeData, parseBackup, serializeBackup } from '../src/data/backup';
import { DataFormatError, migrate } from '../src/data/migrations';
import type { AppData } from '../src/domain/types';

function sample(): AppData {
  return {
    ...emptyData(),
    tasks: [{ id: 't1', description: 'Scale', createdAt: '2026-11-01T10:00:00.000Z', dueDate: '2026-11-24' }],
    sessions: [{ id: 's1', taskId: 't1', at: '2026-11-23T18:00:00.000Z', date: '2026-11-23', tempo: 96, rating: 8, intervalDays: 1, recommendedDays: 1, note: 'ok' }],
  };
}

describe('backup', () => {
  it('round-trips through serialize/parse', () => {
    const d = sample();
    const parsed = parseBackup(serializeBackup(d, '2026-11-23T20:00:00.000Z'));
    expect(parsed).toEqual(d);
  });

  it('rejects invalid JSON, foreign files and newer schemas', () => {
    expect(() => parseBackup('not json')).toThrow(DataFormatError);
    expect(() => parseBackup(JSON.stringify({ tasks: [], sessions: [] }))).toThrow(/not a Practice backup/);
    expect(() => parseBackup(JSON.stringify({ app: 'wkv-practice', schemaVersion: 99, tasks: [], sessions: [] }))).toThrow(/newer version/);
  });

  it('merges by id, keeps existing items, and recomputes due dates', () => {
    const current = sample();
    const incoming: AppData = {
      ...emptyData(),
      tasks: [
        { id: 't1', description: 'Renamed elsewhere', createdAt: '2026-11-01T10:00:00.000Z', dueDate: '2026-11-20' },
        { id: 't2', description: 'Arpeggios', createdAt: '2026-11-02T10:00:00.000Z', dueDate: '2026-11-23' },
      ],
      sessions: [
        { id: 's2', taskId: 't1', at: '2026-11-24T18:00:00.000Z', date: '2026-11-24', tempo: 100, rating: 9, intervalDays: 1, recommendedDays: 1 },
        { id: 's3', taskId: 't2', at: '2026-11-22T18:00:00.000Z', date: '2026-11-22', tempo: null, rating: 6, intervalDays: 1, recommendedDays: 1 },
      ],
    };
    const merged = mergeData(current, incoming);
    expect(merged.tasks.map((t) => [t.id, t.description, t.dueDate])).toEqual([
      ['t1', 'Scale', '2026-11-25'],
      ['t2', 'Arpeggios', '2026-11-23'],
    ]);
    expect(merged.sessions.map((s) => s.id).sort()).toEqual(['s1', 's2', 's3']);
    expect(merged.settings).toBe(current.settings);
  });
});

describe('migrate', () => {
  it('fills in missing settings and clamps out-of-range values', () => {
    const d = migrate({
      tasks: [{ id: 't1', description: 'x', createdAt: '2026-11-01T00:00:00.000Z', dueDate: '2026-11-02' }],
      sessions: [{ id: 's1', taskId: 't1', at: '2026-11-01T00:00:00.000Z', date: '2026-11-01', rating: 14, tempo: -3, intervalDays: 0 }],
      settings: { scheduler: { strongRating: 9 }, theme: 'neon' },
    });
    expect(d.sessions[0]).toMatchObject({ rating: 10, tempo: null, intervalDays: 1, recommendedDays: 1 });
    expect(d.settings.scheduler.strongRating).toBe(9);
    expect(d.settings.scheduler.sessionsToGraduate).toBe(5);
    expect(d.settings.theme).toBe('system');
  });

  it('drops sessions whose task no longer exists and rejects malformed tasks', () => {
    const d = migrate({ tasks: [], sessions: [{ id: 's', taskId: 'gone', at: 'x', date: '2026-11-01', rating: 5 }] });
    expect(d.sessions).toEqual([]);
    expect(() => migrate({ tasks: [{ id: 1 }], sessions: [] })).toThrow(DataFormatError);
  });
});
