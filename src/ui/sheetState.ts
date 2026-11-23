import { signal } from '@preact/signals';

export type SheetState =
  | { kind: 'log'; taskId: string }
  | { kind: 'newTask' }
  | { kind: 'editTask'; taskId: string }
  | { kind: 'editSession'; sessionId: string }
  | null;

export const sheet = signal<SheetState>(null);

export function openSheet(s: Exclude<SheetState, null>): void {
  sheet.value = s;
}

export function closeSheet(): void {
  sheet.value = null;
}
