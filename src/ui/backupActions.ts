import { backupFileName, deliverBackup, mergeData, parseBackup, serializeBackup } from '../data/backup';
import { nowISO, today } from '../data/clock';
import { isDesktop } from '../data/platform';
import { data, markBackedUp, replaceAllData } from '../data/store';
import { ask, showToast } from './feedback';
import { plural } from './format';

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

export async function exportBackup(): Promise<void> {
  try {
    const json = serializeBackup(data.value, nowISO());
    const result = await deliverBackup(json, backupFileName(today.value), !isDesktop());
    if (result === 'cancelled') return;
    markBackedUp();
    showToast(result === 'shared' ? 'Backup shared' : 'Backup downloaded');
  } catch (err) {
    showToast(`Export failed: ${message(err)}`);
  }
}

export async function importBackupFile(file: File): Promise<void> {
  let incoming;
  try {
    incoming = parseBackup(await file.text());
  } catch (err) {
    await ask("Can't import this file", message(err), [{ label: 'OK', value: 'ok', style: 'cancel' }]);
    return;
  }
  const choice = await ask(
    'Import backup',
    `The file has ${plural(incoming.tasks.length, 'task')} and ${plural(incoming.sessions.length, 'session')}. Merge it with the data on this device, or replace everything (including settings)?`,
    [
      { label: 'Merge', value: 'merge' },
      { label: 'Replace All', value: 'replace', style: 'destructive' },
      { label: 'Cancel', value: 'cancel', style: 'cancel' },
    ],
  );
  if (choice === 'merge') {
    replaceAllData(mergeData(data.value, incoming));
    showToast('Backup merged');
  } else if (choice === 'replace') {
    replaceAllData(incoming);
    showToast('Backup restored');
  }
}
