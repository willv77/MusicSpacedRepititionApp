import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';

interface ToastAction {
  label: string;
  run: () => void;
}

interface ToastState {
  id: number;
  message: string;
  action?: ToastAction;
  sticky?: boolean;
}

export const toast = signal<ToastState | null>(null);
let toastSeq = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;

export function showToast(message: string, options: { action?: ToastAction; sticky?: boolean; ms?: number } = {}): void {
  clearTimeout(toastTimer);
  toast.value = { id: ++toastSeq, message, action: options.action, sticky: options.sticky };
  if (!options.sticky) {
    toastTimer = setTimeout(() => {
      toast.value = null;
    }, options.ms ?? 2800);
  }
}

export function Toast() {
  const t = toast.value;
  if (!t) return null;
  return (
    <div class="toast" role="status" aria-live="polite" key={t.id}>
      <span>{t.message}</span>
      {t.action && (
        <button
          type="button"
          onClick={() => {
            toast.value = null;
            t.action?.run();
          }}
        >
          {t.action.label}
        </button>
      )}
    </div>
  );
}

export interface DialogButton {
  label: string;
  value: string;
  style?: 'default' | 'cancel' | 'destructive';
}

interface DialogState {
  title: string;
  message?: string;
  buttons: DialogButton[];
  resolve: (value: string | null) => void;
}

const dialog = signal<DialogState | null>(null);

/** iOS-style alert. Resolves with the chosen button's value, or null if dismissed. */
export function ask(title: string, message: string | undefined, buttons: DialogButton[]): Promise<string | null> {
  return new Promise((resolve) => {
    dialog.value?.resolve(null);
    dialog.value = { title, message, buttons, resolve };
  });
}

export async function confirmDestructive(title: string, message: string, confirmLabel: string): Promise<boolean> {
  const v = await ask(title, message, [
    { label: confirmLabel, value: 'yes', style: 'destructive' },
    { label: 'Cancel', value: 'no', style: 'cancel' },
  ]);
  return v === 'yes';
}

function close(value: string | null) {
  const d = dialog.value;
  dialog.value = null;
  d?.resolve(value);
}

export function DialogHost() {
  const d = dialog.value;
  useEffect(() => {
    if (!d) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [d]);
  if (!d) return null;
  return (
    <div class="dialog-backdrop" onClick={(e) => e.target === e.currentTarget && close(null)}>
      <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title">
        <div class="dialog-text">
          <h2 id="dialog-title">{d.title}</h2>
          {d.message && <p>{d.message}</p>}
        </div>
        {d.buttons.map((b) => (
          <button type="button" key={b.value} class={b.style ?? 'default'} onClick={() => close(b.value)}>
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
