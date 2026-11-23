import { effect, signal, type ReadonlySignal } from '@preact/signals';
import { isIOS, isStandalone } from './platform';

/** Device-local opt-in (tied to this device's notification permission); never part of backups. */
export const BADGE_KEY = 'wkv-practice:app-badge';

type BadgeNavigator = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

export type BadgeSupport = 'supported' | 'needs-install' | 'unsupported';
export type BadgePermission = NotificationPermission | 'not-required';
export type EnableBadgeResult = 'enabled' | 'denied' | 'needs-install' | 'unsupported';

function nav(): BadgeNavigator | undefined {
  return typeof navigator === 'undefined' ? undefined : (navigator as BadgeNavigator);
}

export function badgeSupport(): BadgeSupport {
  const n = nav();
  if (typeof n?.setAppBadge === 'function' && typeof n.clearAppBadge === 'function') return 'supported';
  // iOS exposes the Badging API only to Home Screen web apps, not to Safari tabs.
  if (isIOS() && !isStandalone()) return 'needs-install';
  return 'unsupported';
}

/** WebKit (iPhone/iPad Home Screen apps, Safari web apps on Mac) only shows badges once notifications are allowed. */
export function badgeNeedsPermission(): boolean {
  if (typeof Notification === 'undefined') return false;
  const ua = nav()?.userAgent ?? '';
  return isIOS() || (/Safari\//.test(ua) && !/Chrome|Chromium|Edg\//.test(ua));
}

function readPermission(): BadgePermission {
  return badgeNeedsPermission() ? Notification.permission : 'not-required';
}

function readEnabled(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(BADGE_KEY) === '1';
  } catch {
    return false;
  }
}

function persistEnabled(on: boolean): void {
  try {
    if (on) localStorage.setItem(BADGE_KEY, '1');
    else localStorage.removeItem(BADGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

export const badgeEnabled = signal(readEnabled());
export const badgePermission = signal<BadgePermission>(readPermission());

/**
 * Turns the badge on, asking for notification permission where WebKit requires it.
 * Call it directly from a tap handler: iOS only shows the permission prompt during a user gesture,
 * so nothing may be awaited before `Notification.requestPermission()`.
 */
export async function enableBadge(): Promise<EnableBadgeResult> {
  const support = badgeSupport();
  if (support !== 'supported') return support;
  if (badgeNeedsPermission()) {
    let permission = Notification.permission;
    if (permission === 'default') permission = await Notification.requestPermission();
    badgePermission.value = permission;
    if (permission !== 'granted') return 'denied';
  }
  persistEnabled(true);
  badgeEnabled.value = true;
  return 'enabled';
}

export function disableBadge(): void {
  persistEnabled(false);
  badgeEnabled.value = false;
}

/** Re-reads the opt-in and permission (e.g. after the user changes notification settings and returns). */
export function refreshBadgeState(): void {
  badgeEnabled.value = readEnabled();
  badgePermission.value = readPermission();
}

/** Mirrors `count` onto the app icon while enabled and clears it otherwise. Returns a disposer. */
export function initBadge(count: ReadonlySignal<number>): () => void {
  return effect(() => {
    const n = count.value;
    const on = badgeEnabled.value;
    const b = nav();
    if (typeof b?.setAppBadge !== 'function' || typeof b.clearAppBadge !== 'function') return;
    const pending = on && n > 0 ? b.setAppBadge(n) : b.clearAppBadge();
    void pending?.catch(() => undefined);
  });
}
