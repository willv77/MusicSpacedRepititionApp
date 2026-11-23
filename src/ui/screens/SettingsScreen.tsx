import { useEffect, useRef, useState } from 'preact/hooks';
import { addDays, daysBetween, isLocalDate, toLocalDate } from '../../domain/dates';
import { DEFAULT_SETTINGS } from '../../domain/defaults';
import { buildSampleData } from '../../domain/sample';
import type { SchedulerSettings, ThemeSetting } from '../../domain/types';
import { realToday, setTestDate, testDate, testModeActive, testModeAvailable, today } from '../../data/clock';
import { badgeEnabled, badgePermission, badgeSupport, disableBadge, enableBadge } from '../../data/badge';
import { isIOS, isStandalone } from '../../data/platform';
import { checkForUpdate } from '../../data/pwa';
import { data, dueCount, eraseTasksAndSessions, newId, replaceAllData, updateScheduler, updateSettings } from '../../data/store';
import { exportBackup, importBackupFile } from '../backupActions';
import { Segmented, Stepper, Switch } from '../components/controls';
import { ChevronRight } from '../components/Icons';
import { ask, confirmDestructive, showToast } from '../feedback';
import { fullDate, plural } from '../format';

function NumberRow(props: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  prefix?: string;
  decimals?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div class="field">
      <span class="label">
        {props.label}
        {props.hint && <small>{props.hint}</small>}
      </span>
      <Stepper
        compact
        label={props.label}
        value={props.value}
        min={props.min}
        max={props.max}
        step={props.step}
        unit={props.unit}
        prefix={props.prefix}
        decimals={props.decimals}
        onChange={(v) => v != null && props.onChange(v)}
      />
    </div>
  );
}

export function SettingsScreen() {
  const d = data.value;
  const st = d.settings;
  const s = st.scheduler;
  const fileInput = useRef<HTMLInputElement>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null));
  }, []);

  const set = (patch: Partial<SchedulerSettings>) => updateScheduler(patch);
  const lastBackup = st.lastBackupAt ? toLocalDate(new Date(st.lastBackupAt)) : null;
  const backupAge = lastBackup ? daysBetween(lastBackup, today.value) : null;

  const onCheckUpdate = async () => {
    const r = await checkForUpdate();
    showToast(r === 'unavailable' ? 'Updates are checked automatically in the installed app' : r === 'update-found' ? 'Update found — reload when prompted' : 'You have the latest version');
  };

  return (
    <div class="screen">
      <div class="navbar" />
      <h1 class="large-title">Settings</h1>

      {/* ---------- Backup ---------- */}
      <h2 class="section-h">Backup</h2>
      <div class="group">
        <div class="field">
          <span class="label">Last backup</span>
          <span class="row-value" style={backupAge == null || backupAge >= 14 ? { color: 'var(--orange)', fontWeight: 600 } : undefined}>
            {backupAge == null ? 'Never' : backupAge === 0 ? 'Today' : `${plural(backupAge, 'day')} ago`}
          </span>
        </div>
        <button type="button" class="row action" onClick={() => void exportBackup()}>
          <span class="row-main">Export backup (.json)…</span>
        </button>
        <button type="button" class="row action" onClick={() => fileInput.current?.click()}>
          <span class="row-main">Import backup…</span>
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            e.currentTarget.value = '';
            if (file) void importBackupFile(file);
          }}
        />
      </div>
      <p class="section-f">
        Data is stored only on this device{persisted ? ' (persistent storage granted)' : ''}. On iPhone, deleting the Home Screen app deletes its data — export
        regularly and save the file to Files or iCloud Drive.
      </p>

      {/* ---------- Scheduling ---------- */}
      <h2 class="section-h">Scheduling</h2>
      <div class="group">
        <NumberRow label="Strong rating" hint="A session counts toward the streak at or above this" value={s.strongRating} min={1} max={10} prefix="≥" onChange={(v) => set({ strongRating: v })} />
        <NumberRow label="Consecutive to graduate" hint="Strong sessions in a row before gaps grow" value={s.sessionsToGraduate} min={1} max={20} onChange={(v) => set({ sessionsToGraduate: v })} />
        <div class="field">
          <span class="label">
            One per day
            <small>Several strong sessions on one day count once</small>
          </span>
          <Switch label="Count one strong session per day" checked={s.countOnePerDay} onChange={(v) => set({ countOnePerDay: v })} />
        </div>
        <NumberRow label="Growth when rated 8" value={s.growthAt8} min={1} max={5} step={0.25} decimals prefix="×" onChange={(v) => set({ growthAt8: v })} />
        <NumberRow label="Growth when rated 9" value={s.growthAt9} min={1} max={5} step={0.25} decimals prefix="×" onChange={(v) => set({ growthAt9: v })} />
        <NumberRow label="Growth when rated 10" value={s.growthAt10} min={1} max={5} step={0.25} decimals prefix="×" onChange={(v) => set({ growthAt10: v })} />
        <NumberRow label="Shortest graduated gap" value={s.minGraduatedDays} min={1} max={60} unit="d" onChange={(v) => set({ minGraduatedDays: v })} />
        <NumberRow label="Longest gap" value={s.maxIntervalDays} min={Math.max(2, s.minGraduatedDays)} max={365} unit="d" onChange={(v) => set({ maxIntervalDays: v })} />
        <button
          type="button"
          class="row action"
          onClick={async () => {
            if (await confirmDestructive('Reset scheduling?', 'Restore the default scheduling rules.', 'Reset')) updateScheduler({ ...DEFAULT_SETTINGS.scheduler });
          }}
        >
          <span class="row-main">Reset to defaults</span>
        </button>
      </div>
      <p class="section-f">
        Recommended next practice is 1 day until a task has {s.sessionsToGraduate} consecutive sessions rated {s.strongRating}+. Any lower rating resets the
        streak. After that, the gap since the last session is multiplied by the growth factor (rounded, {s.minGraduatedDays}–{s.maxIntervalDays} days).
      </p>

      {/* ---------- Logging & appearance ---------- */}
      <h2 class="section-h">Logging &amp; appearance</h2>
      <div class="group">
        <NumberRow label="Tempo step" hint="Added to the suggested tempo after a strong session" value={st.tempoStep} min={0} max={20} unit="BPM" onChange={(v) => updateSettings({ tempoStep: v })} />
        <div class="field col">
          <span class="label">Rating label</span>
          <Segmented
            inRow
            value={st.ratingLabel === 'How did it go?' ? 'how' : 'difficulty'}
            onChange={(v) => updateSettings({ ratingLabel: v === 'how' ? 'How did it go?' : 'Difficulty' })}
            options={[
              { value: 'difficulty', label: 'Difficulty' },
              { value: 'how', label: 'How did it go?' },
            ]}
          />
        </div>
        <div class="field col">
          <span class="label">Theme</span>
          <Segmented<ThemeSetting>
            inRow
            value={st.theme}
            onChange={(v) => updateSettings({ theme: v })}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </div>
      </div>

      {/* ---------- App icon badge ---------- */}
      <BadgeSection />

      {/* ---------- Test mode (desktop only) ---------- */}
      {testModeAvailable && <TestModeSection />}

      {/* ---------- Data ---------- */}
      <h2 class="section-h">Data</h2>
      <div class="group">
        <div class="field">
          <span class="label">Stored</span>
          <span class="row-value">
            {plural(d.tasks.length, 'task')} · {plural(d.sessions.length, 'session')}
          </span>
        </div>
        <button
          type="button"
          class="row destructive"
          onClick={async () => {
            if (
              await confirmDestructive(
                'Erase all tasks and sessions?',
                'This cannot be undone. Export a backup first if you might need this data. Settings are kept.',
                'Erase Everything',
              )
            ) {
              eraseTasksAndSessions();
              showToast('All tasks and sessions erased');
            }
          }}
        >
          <span class="row-main">Erase all tasks &amp; sessions…</span>
        </button>
      </div>

      {/* ---------- About ---------- */}
      <h2 class="section-h">About</h2>
      <div class="group">
        <div class="field">
          <span class="label">Version</span>
          <span class="row-value version">
            {__APP_VERSION__} · {__BUILD_DATE__.slice(0, 10)}
          </span>
        </div>
        <button type="button" class="row action" onClick={() => void onCheckUpdate()}>
          <span class="row-main">Check for update</span>
          <ChevronRight />
        </button>
      </div>
      <p class="section-f">
        Install on iPhone: open this page in Safari → Share → Add to Home Screen, then always launch from the icon. The installed app works offline.
      </p>
    </div>
  );
}

const okButton = [{ label: 'OK', value: 'ok', style: 'cancel' as const }];

function BadgeSection() {
  const enabled = badgeEnabled.value;
  const permission = badgePermission.value;
  const support = badgeSupport();
  const due = dueCount.value;
  const blocked = enabled && permission !== 'granted' && permission !== 'not-required';

  const onToggle = async (on: boolean) => {
    if (!on) {
      disableBadge();
      return;
    }
    // enableBadge() must run synchronously inside this tap so iOS shows the permission prompt.
    const result = await enableBadge();
    if (result === 'enabled') {
      showToast(due > 0 ? `Badge on · ${plural(due, 'task')} due` : 'Badge on · nothing due right now');
    } else if (result === 'denied') {
      await ask(
        'Badge needs notifications',
        'iOS only shows app badges when notifications are allowed. Turn on notifications in iOS Settings → Notifications → Practice, then try again. The app never sends notifications.',
        okButton,
      );
    } else if (result === 'needs-install') {
      await ask('Install the app first', 'App icon badges only work in the Home Screen app. In Safari, tap Share → Add to Home Screen, open Practice from the icon, then turn this on.', okButton);
    } else {
      showToast("This browser doesn't support app icon badges");
    }
  };

  let note: string;
  if (support === 'needs-install') {
    note = 'Available in the installed app: in Safari tap Share → Add to Home Screen, open Practice from the icon, then turn this on.';
  } else if (support === 'unsupported') {
    note = "This browser doesn't support app icon badges.";
  } else if (blocked) {
    note = 'Notifications are off for Practice, so iOS hides the badge. Turn them on in iOS Settings → Notifications → Practice.';
  } else {
    note =
      'Shows how many tasks are due or overdue today. The badge updates whenever the app is open; it can’t change while the app is closed, so after midnight it catches up the next time you open the app.';
    if (permission !== 'not-required') note += ' iOS asks for notification permission because badges are part of notifications — the app never sends any.';
    else if (!isIOS() && !isStandalone()) note += ' On a computer it appears on the installed app’s icon (Chrome or Edge: Install app).';
  }

  return (
    <>
      <h2 class="section-h">App icon</h2>
      <div class="group">
        <div class="field">
          <span class="label">
            Badge with today's count
            <small>{blocked ? 'Notifications are off' : `${plural(due, 'task')} due or overdue now`}</small>
          </span>
          <Switch label="App icon badge" checked={enabled} onChange={(v) => void onToggle(v)} />
        </div>
      </div>
      <p class="section-f">{note}</p>
    </>
  );
}

function TestModeSection() {
  const active = testModeActive.value;
  const current = testDate.value ?? realToday.value;
  const shift = (n: number) => setTestDate(addDays(current, n));

  return (
    <>
      <h2 class="section-h">Test mode · desktop only</h2>
      <div class="group">
        <div class="field">
          <span class="label">
            Simulate a date
            <small>Use a different "today" to see how the schedule plays out</small>
          </span>
          <Switch label="Test mode" checked={active} onChange={(v) => setTestDate(v ? realToday.value : null)} />
        </div>
        {active && (
          <>
            <div class="field">
              <label for="test-date">Today is</label>
              <input
                id="test-date"
                class="date-input"
                type="date"
                value={current}
                onChange={(e) => {
                  const v = e.currentTarget.value;
                  if (isLocalDate(v)) setTestDate(v);
                }}
              />
            </div>
            <div class="field col">
              <span class="row-meta" style={{ marginTop: 0 }}>
                {fullDate(current)} · {daysBetween(realToday.value, current) === 0 ? 'same as real date' : `${daysBetween(realToday.value, current) > 0 ? '+' : ''}${plural(daysBetween(realToday.value, current), 'day')} from real date`}
              </span>
              <div class="btn-row">
                <button type="button" class="chip-btn" onClick={() => shift(-7)}>
                  −1 week
                </button>
                <button type="button" class="chip-btn" onClick={() => shift(-1)}>
                  −1 day
                </button>
                <button type="button" class="chip-btn" onClick={() => shift(1)}>
                  +1 day
                </button>
                <button type="button" class="chip-btn" onClick={() => shift(7)}>
                  +1 week
                </button>
                <button type="button" class="chip-btn" onClick={() => setTestDate(realToday.value)}>
                  Real today
                </button>
              </div>
            </div>
          </>
        )}
        <button
          type="button"
          class="row action"
          onClick={async () => {
            const choice = await ask('Load sample data?', 'Replaces all tasks and sessions on this browser with 8 demo tasks and realistic history relative to the current (simulated) date. Settings are kept.', [
              { label: 'Load Sample Data', value: 'yes', style: 'destructive' },
              { label: 'Cancel', value: 'no', style: 'cancel' },
            ]);
            if (choice === 'yes') {
              replaceAllData(buildSampleData(today.value, newId, data.value.settings));
              showToast('Sample data loaded');
            }
          }}
        >
          <span class="row-main">Load sample data…</span>
        </button>
      </div>
      <p class="section-f">
        Sessions logged in test mode are dated on the simulated day. The simulated date is stored only in this browser and is never included in backups. This
        section is hidden on phones and tablets.
      </p>
    </>
  );
}
