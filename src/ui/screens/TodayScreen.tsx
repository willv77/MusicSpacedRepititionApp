import type { TaskStats } from '../../domain/queue';
import { today } from '../../data/clock';
import { data, settings, todayGroups } from '../../data/store';
import { BackupReminder, DataErrors, InstallBanner } from '../components/Banners';
import { CheckIcon, ChevronRight, PlusIcon } from '../components/Icons';
import { Pips } from '../components/controls';
import { agoLabel, dueLabel, longDate } from '../format';
import { openSheet } from '../sheetState';

type Kind = 'overdue' | 'due' | 'done' | 'upcoming';

function TaskRow({ st, kind }: { st: TaskStats; kind: Kind }) {
  const t = today.value;
  const goal = settings.value.scheduler.sessionsToGraduate;
  const last = st.last;
  const open = () => openSheet({ kind: 'log', taskId: st.task.id });

  if (kind === 'upcoming') {
    return (
      <button type="button" class="row indent" onClick={open}>
        <span class="dot grey" />
        <span class="row-main">
          <span class="row-title" style={{ display: 'block' }}>
            {st.task.description}
          </span>
        </span>
        <span class="row-value">{capitalize(dueLabel(st.task.dueDate, t))}</span>
      </button>
    );
  }

  let meta;
  const todays = kind === 'done' ? st.sessions.filter((x) => x.date === t).at(-1) : undefined;
  if (todays) {
    meta = `${todays.tempo != null ? `${todays.tempo} BPM · ` : ''}${todays.rating}/10 · next ${dueLabel(st.task.dueDate, t)}`;
  } else if (!last) {
    meta = 'New · not practiced yet';
  } else {
    const head = `${last.tempo != null ? `${last.tempo} BPM · ` : ''}${last.rating}/10 · `;
    meta =
      kind === 'overdue' ? (
        <>
          {head}
          <span class="late">{dueLabel(st.task.dueDate, t)}</span>
        </>
      ) : (
        head + agoLabel(last.date, t)
      );
  }

  return (
    <button type="button" class={`row indent${kind === 'done' ? ' done' : ''}`} onClick={open}>
      {kind === 'done' ? (
        <span class="check">
          <CheckIcon />
        </span>
      ) : (
        <span class={`dot ${kind === 'overdue' ? 'red' : 'blue'}`} />
      )}
      <span class="row-main">
        <span class="row-title" style={{ display: 'block' }}>
          {st.task.description}
        </span>
        <span class="row-meta" style={{ display: 'block' }}>
          {meta}
        </span>
      </span>
      {kind !== 'done' && last && <Pips streak={st.streak} goal={goal} />}
      <ChevronRight />
    </button>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Section({ title, items, kind }: { title: string; items: TaskStats[]; kind: Kind }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 class="section-h">{title}</h2>
      <div class="group">
        {items.map((st) => (
          <TaskRow key={st.task.id} st={st} kind={kind} />
        ))}
      </div>
    </section>
  );
}

export function TodayScreen() {
  const g = todayGroups.value;
  const t = today.value;
  const pending = g.overdue.length + g.due.length;
  const total = pending + g.done.length;
  const activeTasks = data.value.tasks.filter((x) => !x.archivedAt).length;

  return (
    <div class="screen">
      <div class="navbar">
        <span />
        <button type="button" class="nav-btn" aria-label="New task" onClick={() => openSheet({ kind: 'newTask' })}>
          <PlusIcon />
        </button>
      </div>
      <h1 class="large-title">Today</h1>
      <p class="subtitle">
        {longDate(t)} · {pending} due · {g.done.length} done
      </p>
      {total > 0 && (
        <div class="progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={g.done.length} aria-label="Done today">
          <i style={{ width: `${(g.done.length / total) * 100}%` }} />
        </div>
      )}

      <DataErrors />
      <InstallBanner />
      <BackupReminder />

      {activeTasks === 0 ? (
        <div class="empty">
          <div class="big">🎵</div>
          <h2>No practice tasks yet</h2>
          <p>Add small, specific tasks — a passage, a scale, a technique. Each new task is due today.</p>
          <button type="button" class="btn inline" onClick={() => openSheet({ kind: 'newTask' })}>
            Add a task
          </button>
        </div>
      ) : (
        <>
          {pending === 0 && (
            <div class="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem' }}>🎉</div>
              <div style={{ fontWeight: 600, marginTop: '4px' }}>{g.done.length > 0 ? 'All done for today' : 'Nothing due today'}</div>
              {g.upcoming[0] && (
                <div class="row-meta" style={{ marginTop: '4px', whiteSpace: 'normal' }}>
                  Next up: {g.upcoming[0].task.description} ({dueLabel(g.upcoming[0].task.dueDate, t)})
                </div>
              )}
            </div>
          )}
          <Section title="Overdue" items={g.overdue} kind="overdue" />
          <Section title="Due today" items={g.due} kind="due" />
          <Section title="Done today" items={g.done} kind="done" />
          <Section title="Upcoming" items={g.upcoming} kind="upcoming" />
          {g.upcoming.length > 0 && <p class="section-f">Tap an upcoming task to practice it early.</p>}
        </>
      )}
    </div>
  );
}
