import { expect, test, type Page } from '@playwright/test';
import { toLocalDate } from '../src/domain/dates';
import { buildToday, computeAllStats } from '../src/domain/queue';
import { buildScaleData, SCALE_LEVELS, SHAPES, specFor } from '../tests/support/scaleData';
import {
  appBadge,
  button,
  expectNoPopup,
  expectPopupOpen,
  expectToast,
  installAsHomeScreenApp,
  openWithData,
  popup,
  popupLatency,
  trackErrors,
  type PopupRole,
} from './support';

/** Tap → first frame with the popup painted. Opening must not depend on how much is behind it. */
const POPUP_BUDGET_MS = 2000;

async function openPopup(page: Page, open: () => Promise<void>, name: string, role: PopupRole = 'dialog') {
  const ms = await popupLatency(page, role, open);
  await expectPopupOpen(page, name, role);
  test.info().annotations.push({ type: 'timing', description: `${name}: ${ms} ms` });
  expect(ms, `${name} open time`).toBeLessThan(POPUP_BUDGET_MS);
  return popup(page, name, role);
}

const tab = (page: Page, name: string) => page.locator('.tabbar .tab').filter({ hasText: name });

for (const shape of SHAPES) {
  test.describe(`${shape} at scale`, () => {
    for (const n of SCALE_LEVELS) {
      test(`n = ${n}: every screen and popup works`, async ({ page }) => {
        test.slow(n >= 5000, 'thousands of rows on screen');
        const today = toLocalDate(new Date());
        const data = buildScaleData(specFor(shape, n, today));
        const stats = computeAllStats(data, today);
        const groups = buildToday(stats);
        const active = stats.filter((st) => !st.task.archivedAt);
        const target = active.reduce((a, b) => (b.sessions.length > a.sessions.length ? b : a));
        const errors = trackErrors(page);
        let pending = groups.overdue.length + groups.due.length;
        let done = groups.done.length;
        let total = n;

        await installAsHomeScreenApp(page);
        await openWithData(page, data);
        const subtitle = page.locator('.subtitle');
        await expect(subtitle).toContainText(`${pending} due · ${done} done`);
        await expect.poll(() => appBadge(page)).toBe(pending);

        // ---- New Task popup ----
        const newTask = await openPopup(page, () => page.locator('button[aria-label="New task"]').first().tap(), 'New Task');
        await newTask.locator('textarea').fill('Scale test — new piece');
        await button(newTask, 'Add').tap();
        await expectToast(page, 'Task added');
        await expectNoPopup(page);
        pending++;
        await expect(subtitle).toContainText(`${pending} due · ${done} done`);

        // ---- Log Session popup on the deepest pending row (long lists need scrolling) ----
        const pendingRow = page
          .locator('section')
          .filter({ has: page.locator('h2.section-h').filter({ hasText: /^(Overdue|Due today)$/ }) })
          .locator('.row')
          .last();
        await pendingRow.scrollIntoViewIfNeeded();
        const loggedTask = await pendingRow.locator('.row-title').textContent();
        const log = await openPopup(page, () => pendingRow.tap(), 'Log Session');
        await button(log.locator('.scale'), '9').tap();
        await log.locator('input[aria-label="Note"]').fill('m. 6 — scale run');
        await button(log, 'Save Session').tap();
        await expectToast(page, 'Logged · next practice');
        await expectNoPopup(page);
        pending--;
        done++;
        total++;
        await expect(subtitle).toContainText(`${pending} due · ${done} done`);
        await expect.poll(() => appBadge(page)).toBe(pending);

        // ---- Tasks list, search and task detail ----
        await tab(page, 'Tasks').tap();
        await expect(page.locator('.segmented button').first()).toHaveText(`Active (${active.length + 1})`);
        await page.locator('.search input').fill(/\(#\d+\)$/.exec(target.task.description)![0]);
        await expect(page.locator('.screen .group .row')).toHaveCount(1);
        await page.locator('.screen .group .row').tap();
        await expect(page.locator('h1.large-title')).toHaveText(target.task.description);
        const sessionCount = target.sessions.length + (loggedTask === target.task.description ? 1 : 0);
        const sessionRows = page.locator('.screen button.hrow');
        await expect(page.locator('.stat-grid b').first()).toHaveText(String(sessionCount));
        await expect(sessionRows).toHaveCount(sessionCount);

        // ---- Edit Task popup ----
        const editTask = await openPopup(page, () => button(page.locator('.navbar'), 'Edit').tap(), 'Edit Task');
        await button(editTask, 'Cancel').tap();
        await expectNoPopup(page);

        if (sessionCount >= 2) {
          // Edit and delete the oldest session: the newest one sets the due date and may be today's.
          const oldest = sessionRows.last();

          // ---- Edit Session popup ----
          await oldest.scrollIntoViewIfNeeded();
          const edit = await openPopup(page, () => oldest.tap(), 'Edit Session');
          await button(edit.locator('.scale'), '10').tap();
          await button(edit, 'Save').tap();
          await expectToast(page, 'Session updated');
          await expectNoPopup(page);

          // ---- Delete confirmation dialog ----
          await oldest.scrollIntoViewIfNeeded();
          const again = await openPopup(page, () => oldest.tap(), 'Edit Session');
          const confirm = await openPopup(page, () => again.locator('button.destructive').tap(), 'Delete this session?', 'alertdialog');
          await button(confirm, 'Delete Session').tap();
          await expectToast(page, 'Session deleted');
          await expectNoPopup(page);
          total--;
          await expect(page.locator('.stat-grid b').first()).toHaveText(String(sessionCount - 1));
        }

        // ---- History across the whole period ----
        await tab(page, 'History').tap();
        await expect(page.locator('.summary b').nth(2)).toHaveText(String(total));
        const days = page.locator('.screen section');
        const shownDays = await days.count();
        expect(shownDays).toBeGreaterThan(0);
        const older = button(page, 'Show older');
        if (await older.isVisible()) {
          await older.tap();
          await expect.poll(() => days.count()).toBeGreaterThan(shownDays);
        }
        const fromHistory = await openPopup(page, () => page.locator('.screen .group .row').first().tap(), 'Edit Session');
        await button(fromHistory, 'Cancel').tap();
        await expectNoPopup(page);

        // ---- Everything survived a relaunch ----
        await page.reload();
        await tab(page, 'Today').tap();
        await expect(subtitle).toContainText(`${pending} due · ${done} done`);
        await expect(page.locator('.notice.error')).toHaveCount(0);
        await tab(page, 'History').tap();
        await expect(page.locator('.summary b').nth(2)).toHaveText(String(total));

        expect(errors).toEqual([]);
      });
    }
  });
}
