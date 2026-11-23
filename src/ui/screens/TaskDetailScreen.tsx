import { toLocalDate } from '../../domain/dates';
import { today } from '../../data/clock';
import { settings, statsById } from '../../data/store';
import { ChevronLeft } from '../components/Icons';
import { HistoryChart, Pips } from '../components/controls';
import { dueLabel, fullDate, plural, shortDate, tempoText } from '../format';
import { navigate, type TabName } from '../router';
import { openSheet } from '../sheetState';

const BACK_LABEL: Record<TabName, string> = { today: 'Today', tasks: 'Tasks', history: 'History', settings: 'Settings' };

export function TaskDetailScreen({ id, from }: { id: string; from: TabName }) {
  const st = statsById.value.get(id);
  const s = settings.value.scheduler;
  const t = today.value;
  const back = () => navigate(`#/${from}`);

  if (!st) {
    return (
      <div class="screen">
        <div class="navbar">
          <button type="button" class="nav-btn" onClick={back}>
            <ChevronLeft /> {BACK_LABEL[from]}
          </button>
        </div>
        <div class="empty">
          <h2>Task not found</h2>
          <p>It may have been deleted.</p>
        </div>
      </div>
    );
  }

  const { task, sessions, streak, graduated, last } = st;
  const goal = s.sessionsToGraduate;
  const newestFirst = [...sessions].reverse();
  const statusClass = task.archivedAt ? '' : st.daysUntilDue < 0 ? 'late' : st.daysUntilDue === 0 ? 'due' : '';
  const statusText = task.archivedAt
    ? 'Archived'
    : st.doneToday
      ? `Done today · next ${shortDate(task.dueDate)}`
      : st.daysUntilDue <= 0
        ? st.daysUntilDue === 0
          ? 'Due today'
          : dueLabel(task.dueDate, t)
        : `Next: ${shortDate(task.dueDate)}`;

  return (
    <div class="screen">
      <div class="navbar">
        <button type="button" class="nav-btn" onClick={back}>
          <ChevronLeft /> {BACK_LABEL[from]}
        </button>
        <button type="button" class="nav-btn" onClick={() => openSheet({ kind: 'editTask', taskId: id })}>
          Edit
        </button>
      </div>
      <h1 class="large-title" style={{ fontSize: '1.6rem', overflowWrap: 'anywhere' }}>
        {task.description}
      </h1>
      <div class="chips">
        <span class={`status-chip ${statusClass}`}>{statusText}</span>
        {graduated ? <span class="badge-grad">Graduated</span> : <span class="status-chip">Learning</span>}
      </div>

      <div class="card" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Pips streak={streak} goal={goal} />
        <span class="row-meta" style={{ whiteSpace: 'normal', marginTop: 0 }}>
          {graduated
            ? `${streak} in a row at ${s.strongRating}+ — intervals are growing`
            : `${Math.min(streak, goal)} of ${goal} consecutive sessions at ${s.strongRating}+ · practice daily until ${goal}`}
        </span>
      </div>

      <div class="stat-grid">
        <div>
          <b>{sessions.length}</b>
          <small>Sessions</small>
        </div>
        <div>
          <b>{st.lastTempo ?? '—'}</b>
          <small>Last BPM</small>
        </div>
        <div>
          <b>{st.bestTempo ?? '—'}</b>
          <small>Best BPM</small>
        </div>
        <div>
          <b>{last ? `${last.intervalDays}d` : '—'}</b>
          <small>Interval</small>
        </div>
      </div>

      {!task.archivedAt && (
        <div class="detail-actions">
          <button type="button" class="btn" onClick={() => openSheet({ kind: 'log', taskId: id })}>
            Log Session
          </button>
        </div>
      )}

      {sessions.length > 0 ? (
        <>
          <h2 class="section-h">Progress</h2>
          <div class="group">
            <HistoryChart sessions={sessions} strongRating={s.strongRating} maxSessions={20} />
          </div>
          <h2 class="section-h">
            <span>{plural(sessions.length, 'session')}</span>
            <span style={{ textTransform: 'none' }}>tap to edit</span>
          </h2>
          <div class="group">
            {newestFirst.map((x) => (
              <button type="button" key={x.id} class="hrow" onClick={() => openSheet({ kind: 'editSession', sessionId: x.id })}>
                <span>{shortDate(x.date)}</span>
                <span>{tempoText(x.tempo)}</span>
                <span>
                  <span class={`rate${x.rating >= s.strongRating ? ' good' : ''}`}>{x.rating}</span>
                </span>
                <span>{x.intervalDays}d</span>
                {x.note && <span class="note-line">“{x.note}”</span>}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p class="tip">No sessions yet.</p>
      )}
      <p class="tip">Added {fullDate(toLocalDate(new Date(task.createdAt)))}</p>
    </div>
  );
}
