import { useState } from 'preact/hooks';
import { addDays, daysBetween, toLocalDate } from '../../domain/dates';
import { setTestDate, testModeActive, today } from '../../data/clock';
import { isIOS, isStandalone } from '../../data/platform';
import { data, loadError, saveError } from '../../data/store';
import { exportBackup } from '../backupActions';
import { fullDate } from '../format';

export function TestModeBanner() {
  if (!testModeActive.value) return null;
  const t = today.value;
  return (
    <div class="test-banner" role="status">
      <span aria-hidden="true">🧪</span>
      <span class="grow">Test mode · {fullDate(t)}</span>
      <button type="button" aria-label="Previous day" onClick={() => setTestDate(addDays(t, -1))}>
        −1d
      </button>
      <button type="button" aria-label="Next day" onClick={() => setTestDate(addDays(t, 1))}>
        +1d
      </button>
      <button type="button" onClick={() => setTestDate(null)}>
        Exit
      </button>
    </div>
  );
}

const INSTALL_DISMISSED_KEY = 'wkv-practice:install-dismissed';

export function InstallBanner() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(INSTALL_DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  });
  if (dismissed || !isIOS() || isStandalone()) return null;
  return (
    <div class="notice info">
      <span class="grow">
        <b>Install on your iPhone:</b> tap <b>Share</b> → <b>Add to Home Screen</b>. The installed app keeps its own data — anything entered here in
        Safari won't carry over.
      </span>
      <button
        type="button"
        class="x"
        aria-label="Dismiss"
        onClick={() => {
          localStorage.setItem(INSTALL_DISMISSED_KEY, '1');
          setDismissed(true);
        }}
      >
        ✕
      </button>
    </div>
  );
}

const BACKUP_REMINDER_DAYS = 14;

export function BackupReminder() {
  const d = data.value;
  if (d.sessions.length < 5) return null;
  const last = d.settings.lastBackupAt;
  const age = last ? daysBetween(toLocalDate(new Date(last)), today.value) : null;
  if (age != null && age < BACKUP_REMINDER_DAYS) return null;
  return (
    <div class="notice warn">
      <span class="grow">{age == null ? 'You have never backed up your practice data.' : `Last backup was ${age} days ago.`} Data lives only on this device.</span>
      <button type="button" onClick={() => void exportBackup()}>
        Back up
      </button>
    </div>
  );
}

export function DataErrors() {
  return (
    <>
      {loadError.value && (
        <div class="notice error">
          <span class="grow">
            <b>Saved data couldn't be read:</b> {loadError.value} A copy was kept in browser storage. Import a backup in Settings to restore.
          </span>
        </div>
      )}
      {saveError.value && (
        <div class="notice error">
          <span class="grow">
            <b>Couldn't save:</b> {saveError.value}
          </span>
        </div>
      )}
    </>
  );
}
