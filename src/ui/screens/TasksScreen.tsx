import { useState } from 'preact/hooks';
import type { TaskStats } from '../../domain/queue';
import { today } from '../../data/clock';
import { settings, stats } from '../../data/store';
import { ChevronRight, PlusIcon, SearchIcon } from '../components/Icons';
import { Pips, Segmented } from '../components/controls';
import { dueLabel, plural } from '../format';
import { openTask } from '../router';
import { openSheet } from '../sheetState';

type Filter = 'active' | 'due' | 'archived';

export function TasksScreen() {
  const [filter, setFilter] = useState<Filter>('active');
  const [query, setQuery] = useState('');
  const t = today.value;
  const goal = settings.value.scheduler.sessionsToGraduate;
  const all = stats.value;

  const active = all.filter((s) => !s.task.archivedAt);
  const due = active.filter((s) => s.daysUntilDue <= 0 && !s.doneToday);
  const archived = all.filter((s) => s.task.archivedAt);
  const source = filter === 'active' ? active : filter === 'due' ? due : archived;
  const q = query.trim().toLowerCase();
  const list = source
    .filter((s) => !q || s.task.description.toLowerCase().includes(q))
    .sort((a, b) => a.task.dueDate.localeCompare(b.task.dueDate) || a.task.description.localeCompare(b.task.description));

  const meta = (s: TaskStats) => {
    const n = plural(s.sessions.length, 'session');
    if (s.task.archivedAt) return `${n} · archived`;
    if (s.doneToday) return `${n} · done today · next ${dueLabel(s.task.dueDate, t)}`;
    return s.daysUntilDue < 0 ? (
      <>
        {n} · <span class="late">{dueLabel(s.task.dueDate, t)}</span>
      </>
    ) : (
      `${n} · ${s.daysUntilDue === 0 ? 'due today' : `next ${dueLabel(s.task.dueDate, t)}`}`
    );
  };

  return (
    <div class="screen">
      <div class="navbar">
        <span />
        <button type="button" class="nav-btn" aria-label="New task" onClick={() => openSheet({ kind: 'newTask' })}>
          <PlusIcon />
        </button>
      </div>
      <h1 class="large-title">Tasks</h1>
      <label class="search">
        <SearchIcon />
        <span class="sr-only">Search tasks</span>
        <input type="search" placeholder="Search" value={query} onInput={(e) => setQuery(e.currentTarget.value)} />
      </label>
      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'active', label: `Active (${active.length})` },
          { value: 'due', label: `Due (${due.length})` },
          { value: 'archived', label: `Archived (${archived.length})` },
        ]}
      />

      {list.length === 0 ? (
        <div class="empty">
          <p>
            {q
              ? 'No tasks match your search.'
              : filter === 'archived'
                ? 'No archived tasks. Archive a task from its detail page to hide it from Today while keeping its history.'
                : filter === 'due'
                  ? 'Nothing is due right now. 🎉'
                  : 'No tasks yet. Tap + to add one.'}
          </p>
        </div>
      ) : (
        <>
          <h2 class="section-h">Sorted by next practice</h2>
          <div class="group">
            {list.map((s) => (
              <button type="button" key={s.task.id} class="row" onClick={() => openTask(s.task.id, 'tasks')}>
                <span class="row-main">
                  <span class="row-title" style={{ display: 'block' }}>
                    {s.task.description}
                  </span>
                  <span class="row-meta" style={{ display: 'block' }}>
                    {meta(s)}
                  </span>
                </span>
                {s.sessions.length > 0 && <Pips streak={s.streak} goal={goal} />}
                <ChevronRight />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
