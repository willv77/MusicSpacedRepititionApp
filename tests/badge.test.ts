import { signal } from '@preact/signals';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BADGE_KEY, badgeEnabled, badgePermission, badgeSupport, disableBadge, enableBadge, initBadge, refreshBadgeState } from '../src/data/badge';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
const FIREFOX = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0';

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v));
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

interface Env {
  userAgent: string;
  badging?: boolean;
  standalone?: boolean;
  permission?: NotificationPermission | null;
  grant?: NotificationPermission;
}

function setup(env: Env) {
  const setAppBadge = vi.fn(() => Promise.resolve());
  const clearAppBadge = vi.fn(() => Promise.resolve());
  const requestPermission = vi.fn(() => Promise.resolve(env.grant ?? 'granted'));
  vi.stubGlobal('navigator', {
    userAgent: env.userAgent,
    maxTouchPoints: env.userAgent === IPHONE ? 5 : 0,
    standalone: env.standalone ?? false,
    ...(env.badging ? { setAppBadge, clearAppBadge } : {}),
  });
  vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
  vi.stubGlobal('localStorage', new MemoryStorage());
  if (env.permission !== null) {
    vi.stubGlobal('Notification', { permission: env.permission ?? 'default', requestPermission });
  }
  refreshBadgeState();
  return { setAppBadge, clearAppBadge, requestPermission };
}

beforeEach(() => {
  badgeEnabled.value = false;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('badgeSupport', () => {
  it('needs the Home Screen app on iPhone Safari', () => {
    setup({ userAgent: IPHONE, permission: null });
    expect(badgeSupport()).toBe('needs-install');
  });

  it('is supported where the Badging API exists and unsupported elsewhere', () => {
    setup({ userAgent: IPHONE, badging: true, standalone: true });
    expect(badgeSupport()).toBe('supported');
    setup({ userAgent: FIREFOX, permission: null });
    expect(badgeSupport()).toBe('unsupported');
  });
});

describe('enableBadge', () => {
  it('asks for notification permission on iPhone and enables the badge when granted', async () => {
    const { requestPermission } = setup({ userAgent: IPHONE, badging: true, standalone: true, permission: 'default', grant: 'granted' });
    await expect(enableBadge()).resolves.toBe('enabled');
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(badgeEnabled.value).toBe(true);
    expect(badgePermission.value).toBe('granted');
    expect(localStorage.getItem(BADGE_KEY)).toBe('1');
  });

  it('stays off when notification permission is refused', async () => {
    setup({ userAgent: IPHONE, badging: true, standalone: true, permission: 'default', grant: 'denied' });
    await expect(enableBadge()).resolves.toBe('denied');
    expect(badgeEnabled.value).toBe(false);
    expect(localStorage.getItem(BADGE_KEY)).toBeNull();
  });

  it('does not prompt again when permission is already granted', async () => {
    const { requestPermission } = setup({ userAgent: IPHONE, badging: true, standalone: true, permission: 'granted' });
    await expect(enableBadge()).resolves.toBe('enabled');
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('does not ask for notification permission in Chromium browsers', async () => {
    const { requestPermission } = setup({ userAgent: CHROME, badging: true, permission: 'default' });
    await expect(enableBadge()).resolves.toBe('enabled');
    expect(requestPermission).not.toHaveBeenCalled();
    expect(badgePermission.value).toBe('not-required');
  });

  it('reports why it cannot be enabled', async () => {
    setup({ userAgent: IPHONE, permission: null });
    await expect(enableBadge()).resolves.toBe('needs-install');
    setup({ userAgent: FIREFOX, permission: null });
    await expect(enableBadge()).resolves.toBe('unsupported');
    expect(badgeEnabled.value).toBe(false);
  });

  it('disableBadge turns it off and forgets the opt-in', async () => {
    setup({ userAgent: CHROME, badging: true });
    await enableBadge();
    disableBadge();
    expect(badgeEnabled.value).toBe(false);
    expect(localStorage.getItem(BADGE_KEY)).toBeNull();
  });
});

describe('initBadge', () => {
  it('mirrors the due count onto the icon while enabled', () => {
    const { setAppBadge, clearAppBadge } = setup({ userAgent: CHROME, badging: true });
    const count = signal(4);
    const dispose = initBadge(count);
    expect(clearAppBadge).toHaveBeenCalledTimes(1); // starts disabled

    badgeEnabled.value = true;
    expect(setAppBadge).toHaveBeenLastCalledWith(4);

    count.value = 2;
    expect(setAppBadge).toHaveBeenLastCalledWith(2);

    count.value = 0;
    expect(clearAppBadge).toHaveBeenCalledTimes(2);

    count.value = 3;
    expect(setAppBadge).toHaveBeenLastCalledWith(3);
    badgeEnabled.value = false;
    expect(clearAppBadge).toHaveBeenCalledTimes(3);
    expect(setAppBadge).toHaveBeenCalledTimes(3);

    dispose();
    count.value = 9;
    badgeEnabled.value = true;
    expect(setAppBadge).toHaveBeenCalledTimes(3);
  });

  it('does nothing where the Badging API is missing', () => {
    setup({ userAgent: FIREFOX, permission: null });
    badgeEnabled.value = true;
    expect(() => initBadge(signal(3))()).not.toThrow();
  });
});
