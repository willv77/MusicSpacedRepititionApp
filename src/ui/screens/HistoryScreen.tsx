import { useState } from 'preact/hooks';
import { addDays } from '../../domain/dates';
import { compareSessions, practiceStreak } from '../../domain/queue';
import type { Session } from '../../domain/types';
import { today } from '../../data/clock';
import { data, settings, statsById } from '../../data/store';
import { dayHeader, plural, tempoText } from '../format';
import { openSheet } from '../sheetState';

const DAYS_PER_PAGE = 21;

export function HistoryScreen() {
  const [pages, setPages] = useState(1);
  const t = today.value;
  const sessions = data.value.sessions;
  const strong = settings.value.scheduler.strongRating;
  const byId = statsById.value;

  const weekStart = addDays(t, -6);
  const week = sessions.filter((s) => s.date >= weekStart && s.date <= t);
  const weekDays = new Set(week.map((s) => s.date)).size;
  const streak = practiceStreak(sessions, t);

  const groups = new Map<string, Session[]>();
  for (const s of [...sessions].sort(compareSessions).reverse()) {
    const g = groups.get(s.date);
    if (g) g.push(s);
    else groups.set(s.date, [s]);
  }
  const days = [...groups.keys()];
  const visible = days.slice(0, pages * DAYS_PER_PAGE);

  return (
    <div class="screen">
      <div class="navbar" />
      <h1 class="large-title">History</h1>
      <div class="summary" style={{ marginTop: '10px' }}>
        <div>
          <b>{streak}🔥</b>
          <small>day streak</small>
        </div>
        <div>
          <b>{week.length}</b>
          <small>
            sessions · {weekDays}/7 days
          </small>
        </div>
        <div>
          <b>{sessions.length}</b>
          <small>total sessions</small>
        </div>
      </div>

      {days.length === 0 ? (
        <div class="empty">
          <p>No sessions logged yet. Log a session from the Today tab.</p>
        </div>
      ) : (
        visible.map((day) => {
          const list = groups.get(day) ?? [];
          return (
            <section key={day}>
              <h2 class="section-h">
                <span>{dayHeader(day, t)}</span>
                <span style={{ textTransform: 'none' }}>{plural(list.length, 'session')}</span>
              </h2>
              <div class="group">
                {list.map((s) => (
                  <button type="button" key={s.id} class="row" onClick={() => openSheet({ kind: 'editSession', sessionId: s.id })}>
                    <span class="row-main">
                      <span class="row-title" style={{ display: 'block' }}>
                        {byId.get(s.taskId)?.task.description ?? 'Unknown task'}
                      </span>
                      <span class="row-meta" style={{ display: 'block' }}>
                        {tempoText(s.tempo)} · next in {plural(s.intervalDays, 'day')}
                        {s.note ? ` · “${s.note}”` : ''}
                      </span>
                    </span>
                    <span class={`rate${s.rating >= strong ? ' good' : ''}`}>{s.rating}</span>
                  </button>
                ))}
              </div>
            </section>
          );
        })
      )}
      {visible.length < days.length && (
        <div class="detail-actions">
          <button type="button" class="btn secondary" onClick={() => setPages(pages + 1)}>
            Show older
          </button>
        </div>
      )}
    </div>
  );
}
