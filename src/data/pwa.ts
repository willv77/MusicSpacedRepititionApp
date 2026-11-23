import { signal } from '@preact/signals';
import { registerSW } from 'virtual:pwa-register';

export const updateAvailable = signal(false);
export const offlineReady = signal(false);

let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;
let registration: ServiceWorkerRegistration | undefined;

export function initPWA(): void {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  updateSW = registerSW({
    onNeedRefresh() {
      updateAvailable.value = true;
    },
    onOfflineReady() {
      offlineReady.value = true;
    },
    onRegisteredSW(_url, r) {
      registration = r;
    },
  });
}

export async function applyUpdate(): Promise<void> {
  if (updateSW) await updateSW(true);
  else location.reload();
}

export type UpdateCheck = 'unavailable' | 'update-found' | 'up-to-date';

export async function checkForUpdate(): Promise<UpdateCheck> {
  if (!registration) return 'unavailable';
  await registration.update();
  if (registration.waiting || registration.installing) return 'update-found';
  return updateAvailable.value ? 'update-found' : 'up-to-date';
}
