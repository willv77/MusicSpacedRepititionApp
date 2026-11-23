import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Session } from '../../domain/types';
import { dueCount } from '../../data/store';
import { navigate, type TabName } from '../router';
import { CalendarIcon, ClockIcon, ListIcon, SlidersIcon } from './Icons';

// ---------- Pips: consecutive strong sessions toward graduation ----------

export function Pips({ streak, goal }: { streak: number; goal: number }) {
  const shown = Math.min(goal, 10);
  const filled = Math.round((Math.min(streak, goal) / goal) * shown);
  return (
    <span class="pips" role="img" aria-label={`${Math.min(streak, goal)} of ${goal} consecutive strong sessions`}>
      {Array.from({ length: shown }, (_, i) => (
        <i key={i} class={i < filled ? 'on' : undefined} />
      ))}
    </span>
  );
}

// ---------- Stepper: −/+ with typed entry and hold-to-repeat ----------

interface StepperProps {
  value: number | null;
  onChange: (v: number | null) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  label: string;
  allowEmpty?: boolean;
  /** Value used when stepping from empty. */
  emptyStart?: number;
  decimals?: boolean;
  compact?: boolean;
  prefix?: string;
}

const fmt = (v: number | null) => (v == null ? '' : String(Math.round(v * 100) / 100));

export function Stepper(p: StepperProps) {
  const step = p.step ?? 1;
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);
  const valueRef = useRef(p.value);
  valueRef.current = p.value;
  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const repeated = useRef(false);

  useEffect(() => () => clearTimeout(holdTimer.current), []);

  const clamp = (v: number) => Math.min(p.max, Math.max(p.min, Math.round(v / step) * step));

  const apply = (dir: 1 | -1) => {
    const cur = valueRef.current;
    const next = cur == null ? (p.emptyStart ?? p.min) : clamp(Math.round((cur + dir * step) * 100) / 100);
    valueRef.current = next;
    p.onChange(next);
  };

  const startHold = (dir: 1 | -1) => {
    repeated.current = false;
    clearTimeout(holdTimer.current);
    const tick = () => {
      repeated.current = true;
      apply(dir);
      holdTimer.current = setTimeout(tick, 70);
    };
    holdTimer.current = setTimeout(tick, 450);
  };
  const stopHold = () => clearTimeout(holdTimer.current);

  const commitText = () => {
    setEditing(false);
    const trimmed = text.trim();
    if (!trimmed) {
      if (p.allowEmpty) p.onChange(null);
      return;
    }
    const n = Number(trimmed.replace(',', '.'));
    if (!Number.isFinite(n)) return;
    p.onChange(Math.min(p.max, Math.max(p.min, p.decimals ? n : Math.round(n))));
  };

  const button = (dir: 1 | -1) => {
    const disabled = p.value != null && (dir < 0 ? p.value <= p.min : p.value >= p.max);
    return (
      <button
        type="button"
        aria-label={`${dir < 0 ? 'Decrease' : 'Increase'} ${p.label}`}
        disabled={disabled}
        onPointerDown={() => startHold(dir)}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => {
          if (repeated.current) {
            repeated.current = false;
            return;
          }
          apply(dir);
        }}
      >
        {dir < 0 ? '−' : '+'}
      </button>
    );
  };

  return (
    <div class={`stepper${p.compact ? ' compact' : ''}`}>
      {button(-1)}
      <span class="val">
        {p.prefix && <span class="unit" style={{ minWidth: 0 }}>{p.prefix}</span>}
        <input
          type="text"
          inputMode={p.decimals ? 'decimal' : 'numeric'}
          pattern={p.decimals ? undefined : '[0-9]*'}
          aria-label={p.label}
          placeholder="—"
          value={editing ? text : fmt(p.value)}
          onFocus={(e) => {
            setText(fmt(p.value));
            setEditing(true);
            e.currentTarget.select();
          }}
          onInput={(e) => setText(e.currentTarget.value)}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
        {p.unit && <span class="unit">{p.unit}</span>}
      </span>
      {button(1)}
    </div>
  );
}

// ---------- Rating picker ----------

export function RatingPicker({ value, onChange, strongRating, label }: { value: number | null; onChange: (n: number) => void; strongRating: number; label: string }) {
  return (
    <div class="scale" role="radiogroup" aria-label={label}>
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          class={[n >= strongRating ? 'strong' : '', value === n ? 'sel' : ''].join(' ').trim() || undefined}
          onClick={() => onChange(n)}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

// ---------- History chart (tempo line + rating bars) ----------

export function HistoryChart({ sessions, strongRating, maxSessions = 12 }: { sessions: Session[]; strongRating: number; maxSessions?: number }) {
  const list = sessions.slice(-maxSessions);
  if (list.length === 0) return null;
  const W = 330;
  const H = 84;
  const base = 80;
  const barMax = 32;
  const slot = W / Math.max(list.length, 6);
  const offset = W - slot * list.length;
  const cx = (i: number) => offset + slot * (i + 0.5);
  const barW = Math.min(18, slot * 0.55);

  const tempos = list.map((s) => s.tempo).filter((t): t is number => t != null);
  let lo = Math.min(...tempos);
  let hi = Math.max(...tempos);
  if (hi - lo < 8) {
    const mid = (hi + lo) / 2;
    lo = mid - 4;
    hi = mid + 4;
  }
  const ty = (t: number) => 38 - ((t - lo) / (hi - lo)) * 30;
  const pts = list.map((s, i) => (s.tempo == null ? null : { x: cx(i), y: ty(s.tempo), t: s.tempo })).filter((p): p is { x: number; y: number; t: number } => p != null);
  const thrY = base - (strongRating / 10) * barMax;
  const lastPt = pts.at(-1);
  const first = tempos[0];
  const lastT = tempos.at(-1);

  return (
    <div class="chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Last ${list.length} sessions. ${tempos.length ? `Tempo ${first} to ${lastT} BPM.` : ''} Ratings ${list.map((s) => s.rating).join(', ')}.`}
      >
        <line class="thr" x1="0" x2={W} y1={thrY} y2={thrY} />
        {list.map((s, i) => {
          const h = Math.max(3, (s.rating / 10) * barMax);
          return <rect key={s.id} class={`bar${s.rating >= strongRating ? ' good' : ''}`} x={cx(i) - barW / 2} y={base - h} width={barW} height={h} rx="3" />;
        })}
        {pts.length > 1 && <polyline class="line" points={pts.map((p) => `${p.x},${p.y}`).join(' ')} />}
        {pts.map((p, i) => (
          <circle key={i} class={`pt${i === pts.length - 1 ? ' last' : ''}`} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 3.5 : 3} />
        ))}
        {lastPt && (
          <text x={Math.min(lastPt.x - 7, W - 2)} y={Math.max(9, lastPt.y - 7)} text-anchor="end">
            {lastPt.t}
          </text>
        )}
      </svg>
      <div class="legend">
        {tempos.length > 0 && <span>{first === lastT ? `Tempo ${lastT} BPM` : `Tempo ${first} → ${lastT} BPM`}</span>}
        <span class="bars">Rating (green = {strongRating}+)</span>
      </div>
    </div>
  );
}

// ---------- Sheet ----------

interface SheetProps {
  title: string;
  left?: ComponentChildren;
  right?: ComponentChildren;
  footer?: ComponentChildren;
  children: ComponentChildren;
  onClose: () => void;
  tall?: boolean;
}

export function Sheet({ title, left, right, footer, children, onClose, tall }: SheetProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('.dialog-backdrop')) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div class="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class={`sheet${tall ? ' tall' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div class="grabber" />
        <div class="sheet-nav">
          {left ?? <span />}
          <h2>{title}</h2>
          {right ?? <span />}
        </div>
        <div class="sheet-body">{children}</div>
        {footer && <div class="sheet-footer">{footer}</div>}
      </div>
    </div>
  );
}

// ---------- Tab bar ----------

const TABS: { name: TabName; label: string; icon: () => preact.JSX.Element }[] = [
  { name: 'today', label: 'Today', icon: CalendarIcon },
  { name: 'tasks', label: 'Tasks', icon: ListIcon },
  { name: 'history', label: 'History', icon: ClockIcon },
  { name: 'settings', label: 'Settings', icon: SlidersIcon },
];

export function TabBar({ active }: { active: TabName }) {
  const due = dueCount.value;
  return (
    <nav class="tabbar" aria-label="Main">
      {TABS.map(({ name, label, icon: Icon }) => (
        <button
          key={name}
          type="button"
          class={`tab${active === name ? ' active' : ''}`}
          aria-current={active === name ? 'page' : undefined}
          onClick={() => navigate(`#/${name}`)}
        >
          <Icon />
          {label}
          {name === 'today' && due > 0 && <span class="tab-badge" aria-label={`${due} due`}>{due}</span>}
        </button>
      ))}
    </nav>
  );
}

// ---------- Small controls ----------

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label class="switch">
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        aria-label={label}
        onChange={(e) => {
          const next = e.currentTarget.checked;
          // Stay controlled: only a state change (re-render) may flip the switch, e.g. not when a permission is refused.
          e.currentTarget.checked = checked;
          onChange(next);
        }}
      />
      <span />
    </label>
  );
}

export function Segmented<T extends string>({ options, value, onChange, inRow }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; inRow?: boolean }) {
  return (
    <div class={`segmented${inRow ? ' in-row' : ''}`} role="tablist">
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={o.value === value} class={o.value === value ? 'on' : undefined} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
