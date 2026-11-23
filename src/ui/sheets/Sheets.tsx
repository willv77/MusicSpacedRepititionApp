import { useEffect, useRef, useState } from 'preact/hooks';
import { addDays } from '../../domain/dates';
import { RATING_ANCHORS } from '../../domain/defaults';
import { recommendInterval, suggestTempo, type Recommendation } from '../../domain/scheduler';
import type { SchedulerSettings } from '../../domain/types';
import { today } from '../../data/clock';
import {
  addTask,
  data,
  deleteSession,
  deleteTask,
  logSession,
  setTaskArchived,
  settings,
  statsById,
  updateSession,
  updateTaskDescription,
} from '../../data/store';
import { HistoryChart, Pips, RatingPicker, Sheet, Stepper } from '../components/controls';
import { confirmDestructive, showToast } from '../feedback';
import { agoLabel, dueLabel, fullDate, plural, shortDate, tempoText } from '../format';
import { navigate, openTask, route } from '../router';
import { closeSheet, sheet } from '../sheetState';

// ---------- Shared bits ----------

const CancelButton = () => (
  <button type="button" class="nav-btn" onClick={closeSheet}>
    Cancel
  </button>
);

function RatingField({ value, onChange, strong }: { value: number | null; onChange: (n: number) => void; strong: number }) {
  const label = settings.value.ratingLabel;
  return (
    <div class="field col">
      <span class="label">
        {label}
        <small>1 = can't play it · 10 = effortless · green = {strong}+</small>
      </span>
      <RatingPicker value={value} onChange={onChange} strongRating={strong} label={label} />
      <span class="anchor" aria-live="polite">
        {value != null ? `${value} · ${RATING_ANCHORS[value]}` : ' '}
      </span>
    </div>
  );
}

function RecoBanner({ rec, rating, s, days, onUse }: { rec: Recommendation | null; rating: number | null; s: SchedulerSettings; days: number; onUse: () => void }) {
  if (!rec || rating == null) {
    return <div class="reco neutral">Pick a rating to get the recommended next practice.</div>;
  }
  const strong = s.strongRating;
  const goal = s.sessionsToGraduate;
  let cls = 'reco';
  let text;
  switch (rec.reason) {
    case 'learning':
      text =
        rating >= strong ? (
          <>
            <b>Recommended: 1 day</b> · {rec.streak} of {goal} in a row at {strong}+
          </>
        ) : (
          <>
            <b>Recommended: 1 day</b> · below {strong} resets the streak{rec.previousStreak > 0 ? ` (was ${rec.previousStreak} of ${goal})` : ` (0 of ${goal})`}
          </>
        );
      break;
    case 'reset':
      text = (
        <>
          <b>Recommended: 1 day</b> · below {strong} ends the {rec.previousStreak}-session streak — back to daily practice
        </>
      );
      break;
    case 'graduated':
      cls += ' celebrate';
      text = (
        <>
          🎉 <b>{goal} in a row at {strong}+ — graduated!</b> Recommended: {plural(rec.days, 'day')}
        </>
      );
      break;
    case 'growing':
      text = (
        <>
          <b>Recommended: {plural(rec.days, 'day')}</b> · {rec.streak} in a row at {strong}+ ({rec.baseDays}d × {rec.factor})
        </>
      );
      break;
  }
  return (
    <div class={cls} aria-live="polite">
      <span class="grow">{rec.reason === 'graduated' ? text : <>★ {text}</>}</span>
      {days !== rec.days && (
        <button type="button" onClick={onUse}>
          Use {rec.days}
        </button>
      )}
    </div>
  );
}

// ---------- Log Session ----------

export function LogSessionSheet({ taskId }: { taskId: string }) {
  const st = statsById.value.get(taskId);
  const cfg = settings.value;
  const s = cfg.scheduler;
  const t = today.value;
  const [tempo, setTempo] = useState<number | null>(() => (st ? suggestTempo(st.sessions, s, cfg.tempoStep) : null));
  const [rating, setRating] = useState<number | null>(null);
  const [manualDays, setManualDays] = useState<number | null>(null);
  const [note, setNote] = useState('');

  if (!st) return null;

  const rec = rating == null ? null : recommendInterval(st.sessions, { rating, date: t }, s);
  const days = manualDays ?? rec?.days ?? 1;
  const goal = s.sessionsToGraduate;
  const recent = [...st.sessions].reverse().slice(0, 3);
  const last = st.last;
  const suggested = suggestTempo(st.sessions, s, cfg.tempoStep);

  const save = () => {
    if (rating == null || !rec) return;
    logSession({ taskId, tempo, rating, intervalDays: days, recommendedDays: rec.days, note });
    closeSheet();
    showToast(`Logged · next practice ${shortDate(addDays(t, days))}`);
  };

  const showAll = () => {
    closeSheet();
    const r = route.value;
    if (r.name !== 'task' || r.id !== taskId) openTask(taskId, r.name === 'task' ? r.from : r.name);
  };

  return (
    <Sheet
      title="Log Session"
      tall
      onClose={closeSheet}
      left={<CancelButton />}
      footer={
        <button type="button" class="btn" disabled={rating == null} onClick={save}>
          {rating == null ? 'Pick a rating to save' : 'Save Session'}
        </button>
      }
    >
      <div class="taskcard">
        <div class="taskcard-title">{st.task.description}</div>
        <div class="taskcard-meta">
          {st.sessions.length === 0 ? (
            <span>First session for this task</span>
          ) : (
            <>
              <Pips streak={st.streak} goal={goal} />
              <span>
                {st.graduated ? `Graduated · ${st.streak} in a row at ${s.strongRating}+` : `${st.streak} of ${goal} in a row at ${s.strongRating}+`} ·{' '}
                {plural(st.sessions.length, 'session')}
              </span>
            </>
          )}
        </div>
        {st.doneToday && <div class="taskcard-note" style={{ fontStyle: 'normal' }}>Already logged today — this adds another session.</div>}
        {!st.doneToday && st.daysUntilDue > 0 && (
          <div class="taskcard-note" style={{ fontStyle: 'normal' }}>
            Not due until {dueLabel(st.task.dueDate, t)} — practicing early.
          </div>
        )}
        {last?.note && <div class="taskcard-note">Last note: “{last.note}”</div>}
      </div>

      {st.sessions.length > 0 && (
        <>
          <h3 class="section-h">
            <span>Recent history</span>
            <button type="button" class="link" onClick={showAll}>
              All {st.sessions.length} ›
            </button>
          </h3>
          <div class="group">
            <HistoryChart sessions={st.sessions} strongRating={s.strongRating} />
            {recent.map((x) => (
              <div class="hrow" key={x.id}>
                <span>
                  {shortDate(x.date)}
                  <span class="sub">{agoLabel(x.date, t)}</span>
                </span>
                <span>{tempoText(x.tempo)}</span>
                <span>
                  <span class={`rate${x.rating >= s.strongRating ? ' good' : ''}`}>{x.rating}</span>
                </span>
                <span>{x.intervalDays}d</span>
              </div>
            ))}
          </div>
        </>
      )}

      <h3 class="section-h">This session</h3>
      <div class="group">
        <div class="field">
          <span class="label">
            Tempo
            <small>
              {st.lastTempo != null
                ? `last ${st.lastTempo} · best ${st.bestTempo}${suggested != null && suggested !== st.lastTempo ? ` · suggested ${suggested}` : ''}`
                : 'optional — leave blank if not applicable'}
            </small>
          </span>
          <Stepper label="Tempo in BPM" value={tempo} onChange={setTempo} min={10} max={400} unit="BPM" allowEmpty emptyStart={st.lastTempo ?? 60} />
        </div>
        <RatingField value={rating} onChange={setRating} strong={s.strongRating} />
        <div class="field">
          <span class="label">
            Next practice
            <small>{fullDate(addDays(t, days))}</small>
          </span>
          <Stepper label="Days until next practice" value={days} onChange={(v) => v != null && setManualDays(v)} min={1} max={365} unit={days === 1 ? 'day' : 'days'} />
        </div>
        <RecoBanner rec={rec} rating={rating} s={s} days={days} onUse={() => setManualDays(null)} />
        <div class="field">
          <input class="text-input" type="text" placeholder="Note (optional) — e.g. “m. 6 fingering”" value={note} maxLength={200} onInput={(e) => setNote(e.currentTarget.value)} aria-label="Note" />
        </div>
      </div>
    </Sheet>
  );
}

// ---------- New Task ----------

export function NewTaskSheet() {
  const [text, setText] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => ref.current?.focus(), []);

  const add = () => {
    if (addTask(text)) {
      closeSheet();
      showToast('Task added · due today');
    }
  };

  return (
    <Sheet
      title="New Task"
      onClose={closeSheet}
      left={<CancelButton />}
      right={
        <button type="button" class="nav-btn strong" disabled={!text.trim()} onClick={add}>
          Add
        </button>
      }
    >
      <div class="inset">
        <textarea
          ref={ref}
          class="textarea"
          aria-label="Task description"
          placeholder="e.g. Bach Minuet in G — mm. 1–8"
          maxLength={300}
          value={text}
          onInput={(e) => setText(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              add();
            }
          }}
        />
      </div>
      <p class="tip">Keep tasks small and specific: one passage, one scale, one technique. New tasks are due today.</p>
    </Sheet>
  );
}

// ---------- Edit Task ----------

export function EditTaskSheet({ taskId }: { taskId: string }) {
  const task = data.value.tasks.find((x) => x.id === taskId);
  const [text, setText] = useState(task?.description ?? '');
  if (!task) return null;
  const sessionCount = data.value.sessions.filter((x) => x.taskId === taskId).length;

  const save = () => {
    updateTaskDescription(taskId, text);
    closeSheet();
  };

  return (
    <Sheet
      title="Edit Task"
      onClose={closeSheet}
      left={<CancelButton />}
      right={
        <button type="button" class="nav-btn strong" disabled={!text.trim()} onClick={save}>
          Save
        </button>
      }
    >
      <div class="inset">
        <textarea class="textarea" aria-label="Task description" maxLength={300} value={text} onInput={(e) => setText(e.currentTarget.value)} />
      </div>
      <h3 class="section-h">&nbsp;</h3>
      <div class="group">
        <button
          type="button"
          class="row action"
          onClick={() => {
            setTaskArchived(taskId, !task.archivedAt);
            closeSheet();
            showToast(task.archivedAt ? 'Task restored' : 'Task archived');
          }}
        >
          <span class="row-main">{task.archivedAt ? 'Unarchive task' : 'Archive task'}</span>
        </button>
        <button
          type="button"
          class="row destructive"
          onClick={async () => {
            const ok = await confirmDestructive(
              'Delete this task?',
              `This deletes the task and its ${plural(sessionCount, 'session')}. This can't be undone.`,
              'Delete Task',
            );
            if (!ok) return;
            deleteTask(taskId);
            closeSheet();
            const r = route.value;
            if (r.name === 'task' && r.id === taskId) navigate(`#/${r.from}`);
            showToast('Task deleted');
          }}
        >
          <span class="row-main">Delete task…</span>
        </button>
      </div>
      <p class="section-f">Archived tasks are hidden from Today but keep their history.</p>
    </Sheet>
  );
}

// ---------- Edit Session ----------

export function EditSessionSheet({ sessionId }: { sessionId: string }) {
  const session = data.value.sessions.find((x) => x.id === sessionId);
  const task = session ? data.value.tasks.find((x) => x.id === session.taskId) : undefined;
  const s = settings.value.scheduler;
  const [tempo, setTempo] = useState<number | null>(session?.tempo ?? null);
  const [rating, setRating] = useState<number>(session?.rating ?? 5);
  const [days, setDays] = useState<number>(session?.intervalDays ?? 1);
  const [note, setNote] = useState(session?.note ?? '');
  if (!session) return null;

  const save = () => {
    updateSession(sessionId, { tempo, rating, intervalDays: days, note });
    closeSheet();
    showToast('Session updated');
  };

  return (
    <Sheet
      title="Edit Session"
      onClose={closeSheet}
      left={<CancelButton />}
      right={
        <button type="button" class="nav-btn strong" onClick={save}>
          Save
        </button>
      }
    >
      <div class="taskcard">
        <div class="taskcard-title">{task?.description ?? 'Unknown task'}</div>
        <div class="taskcard-meta">
          {fullDate(session.date)} · recommended {plural(session.recommendedDays, 'day')} at the time
        </div>
      </div>
      <h3 class="section-h">Session</h3>
      <div class="group">
        <div class="field">
          <span class="label">Tempo</span>
          <Stepper label="Tempo in BPM" value={tempo} onChange={setTempo} min={10} max={400} unit="BPM" allowEmpty emptyStart={60} />
        </div>
        <RatingField value={rating} onChange={setRating} strong={s.strongRating} />
        <div class="field">
          <span class="label">
            Next practice
            <small>{fullDate(addDays(session.date, days))}</small>
          </span>
          <Stepper label="Days until next practice" value={days} onChange={(v) => v != null && setDays(v)} min={1} max={365} unit={days === 1 ? 'day' : 'days'} />
        </div>
        <div class="field">
          <input class="text-input" type="text" placeholder="Note (optional)" value={note} maxLength={200} onInput={(e) => setNote(e.currentTarget.value)} aria-label="Note" />
        </div>
      </div>
      <p class="section-f">The task's next practice date follows its most recent session.</p>
      <h3 class="section-h">&nbsp;</h3>
      <div class="group">
        <button
          type="button"
          class="row destructive"
          onClick={async () => {
            if (await confirmDestructive('Delete this session?', "This can't be undone.", 'Delete Session')) {
              deleteSession(sessionId);
              closeSheet();
              showToast('Session deleted');
            }
          }}
        >
          <span class="row-main">Delete session…</span>
        </button>
      </div>
    </Sheet>
  );
}

// ---------- Host ----------

export function SheetHost() {
  const s = sheet.value;
  if (!s) return null;
  switch (s.kind) {
    case 'log':
      return <LogSessionSheet key={s.taskId} taskId={s.taskId} />;
    case 'newTask':
      return <NewTaskSheet />;
    case 'editTask':
      return <EditTaskSheet key={s.taskId} taskId={s.taskId} />;
    case 'editSession':
      return <EditSessionSheet key={s.sessionId} sessionId={s.sessionId} />;
  }
}
