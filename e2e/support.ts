import { expect, type Locator, type Page } from '@playwright/test';
import { BADGE_KEY } from '../src/data/badge';
import { DATA_KEY, toStorageJSON } from '../src/data/repository';
import type { AppData } from '../src/domain/types';

// CSS/text locators only: role-based locators compute accessible names for every element and take
// many seconds per query on pages with 10 000 rows.

type TestWindow = Window & { __badge?: number; __toasts?: string[]; __popupLatency?: Promise<number> };

/** Emulates the iPhone Home Screen app (standalone display mode, Badging API) and records toasts. */
export async function installAsHomeScreenApp(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as TestWindow;
    Object.defineProperty(navigator, 'standalone', { configurable: true, get: () => true });
    const matchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query: string) =>
      query.includes('display-mode: standalone')
        ? ({ matches: true, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false } as unknown as MediaQueryList)
        : matchMedia(query);
    Object.assign(navigator, {
      setAppBadge: async (n?: number) => void (w.__badge = n ?? 0),
      clearAppBadge: async () => void (w.__badge = 0),
    });
    // Toasts last 2.8 s; record them so slow assertions elsewhere can't miss one.
    w.__toasts = [];
    const seen = new WeakSet<Element>();
    new MutationObserver(() => {
      const el = document.querySelector('.toast');
      if (el && !seen.has(el)) {
        seen.add(el);
        w.__toasts?.push(el.textContent ?? '');
      }
    }).observe(document, { childList: true, subtree: true });
  });
}

/** Opens the app with `data` already stored, the way it would be after months of use. */
export async function openWithData(page: Page, data: AppData): Promise<void> {
  await page.goto('./#/today');
  await page.evaluate(([dataKey, badgeKey, json]) => {
    localStorage.setItem(dataKey, json);
    localStorage.setItem(badgeKey, '1');
  }, [DATA_KEY, BADGE_KEY, toStorageJSON(data)] as const);
  await page.reload();
  await expect(page.locator('h1.large-title')).toHaveText('Today');
}

export function appBadge(page: Page): Promise<number | undefined> {
  return page.evaluate(() => (window as TestWindow).__badge);
}

export async function expectToast(page: Page, text: string): Promise<void> {
  await expect.poll(() => page.evaluate(() => (window as TestWindow).__toasts ?? [])).toContainEqual(expect.stringContaining(text));
}

/** Collects uncaught errors (service-worker noise from the test server excluded). */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  const record = (text: string) => {
    if (!/sw\.js|service ?worker/i.test(text)) errors.push(text);
  };
  page.on('pageerror', (e) => record(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') record(m.text());
  });
  return errors;
}

export type PopupRole = 'dialog' | 'alertdialog';

/** Sheets are labelled by their title; alert dialogs by their heading text. */
export function popup(page: Page, name: string, role: PopupRole = 'dialog'): Locator {
  return role === 'dialog' ? page.locator(`[role="dialog"][aria-label="${name}"]`) : page.locator('[role="alertdialog"]').filter({ hasText: name });
}

/** A button whose whole text is `text`. */
export function button(scope: Page | Locator, text: string): Locator {
  return scope.locator('button').filter({ hasText: new RegExp(`^\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`) });
}

/**
 * Asserts that a popup really is usable: fully on screen, hit-testable, covering a background that
 * can't be tapped or scrolled, and not nested in any clipping/transformed ancestor (iOS leaves such
 * position:fixed overlays unpainted once the screen behind them scrolls).
 */
export async function expectPopupOpen(page: Page, name: string, role: PopupRole = 'dialog'): Promise<void> {
  const el = popup(page, name, role);
  await expect(el).toBeVisible();
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  const state = await el.evaluate((node) => {
    const r = node.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(30, r.height / 2));
    const clipping: string[] = [];
    for (let p = node.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.overflow !== 'visible' || cs.transform !== 'none' || cs.filter !== 'none') clipping.push(p.id ? `#${p.id}` : `.${p.className}`);
    }
    const screen = document.querySelector('.screen');
    const corner = document.elementFromPoint(4, 4);
    return {
      onScreen: r.top >= 0 && r.bottom <= window.innerHeight + 1,
      hitInside: node.contains(hit),
      clipping,
      backgroundBlocked: !document.querySelector('.app')?.contains(corner),
      backgroundScroll: screen ? getComputedStyle(screen).overflowY : 'hidden',
    };
  });
  expect(state, `${name} popup`).toEqual({ onScreen: true, hitInside: true, clipping: [], backgroundBlocked: true, backgroundScroll: 'hidden' });
}

export async function expectNoPopup(page: Page): Promise<void> {
  await expect(page.locator('[role="dialog"], [role="alertdialog"]')).toHaveCount(0);
}

/** Milliseconds from the tap until the first frame with the popup painted, measured in the page. */
export async function popupLatency(page: Page, role: PopupRole, open: () => Promise<void>): Promise<number> {
  await page.evaluate((role) => {
    let t0 = performance.now();
    addEventListener('click', () => (t0 = performance.now()), { capture: true, once: true });
    (window as TestWindow).__popupLatency = new Promise((resolve) => {
      const mo = new MutationObserver(() => {
        if (!document.querySelector(`[role="${role}"]`)) return;
        mo.disconnect();
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(Math.round(performance.now() - t0))));
      });
      mo.observe(document.body, { childList: true, subtree: true });
    });
  }, role);
  await open();
  return page.evaluate(() => (window as TestWindow).__popupLatency ?? -1);
}
