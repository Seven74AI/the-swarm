import { test, expect, type Page } from '@playwright/test';

/**
 * Story 2.2 (AR6, UX-DR33, NFR8): a save that can't be read is never silently
 * reset. The sheet `THIS SAVE COULDN'T BE READ.` offers LOAD BACKUP and START
 * OVER, and nothing is written (autosave, beforeunload) until the player
 * chooses. A failing write shows `• SAVE FAILED` under the strip.
 *
 * Seeds go in once per test (sessionStorage guard), so a reload sees what the
 * game left in storage, not a fresh seed.
 */

const KEYS = { primary: 'the_swarm_save', backup1: 'the_swarm_save_bak1', unreadable: 'the_swarm_save_unreadable' };
const CORRUPT = '{"version": 19, "gameState": {"phase": "egg_laying"';

/** A readable backup: Phase 1 with a seeded worker count we can recognise after LOAD BACKUP. */
function backupSave(): string {
  return JSON.stringify({
    version: 19,
    timestamp: Date.now(),
    playTimeMs: 0,
    gameState: {
      phase: 'egg_laying',
      lastSaveTimestamp: Date.now(),
      resources: { eggs: 0, larvae: 0, workers: 3, food: 50, nestCapacity: 100 },
    },
  });
}

async function seedStorage(page: Page, items: Record<string, string>): Promise<void> {
  await page.addInitScript((entries: Record<string, string>) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v);
    localStorage.setItem('the_swarm_onboarding', 'done');
  }, items);
}

const sheet = (page: Page) => page.locator('[data-unreadable-save]');
const stored = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);

/** A v1 save whose state lacks what the v1 → v2 migration reads: that step throws. */
const FAILING_MIGRATION = JSON.stringify({ version: 1, timestamp: Date.now(), playTimeMs: 0, gameState: {} });
const FUTURE_VERSION = JSON.stringify({ version: 999, timestamp: Date.now(), playTimeMs: 0, gameState: { phase: 'egg_laying' } });

test.describe('a save that cannot be read', () => {
  for (const [name, text] of [
    ['corrupt JSON', CORRUPT],
    ['an unknown future version', FUTURE_VERSION],
    ['a failing migration', FAILING_MIGRATION],
  ] as const) {
    test(`with ${name} opens the sheet and survives a reload untouched`, async ({ page }) => {
      await seedStorage(page, { [KEYS.primary]: text });
      await page.goto('/');
      await expect(sheet(page)).toBeVisible();
      await page.reload();
      await expect(sheet(page)).toBeVisible();
      expect(await stored(page, KEYS.primary)).toBe(text);
      expect(await stored(page, KEYS.unreadable)).toBe(text);
    });
  }

  test('is kept through reloads until LOAD BACKUP, which boots the backup', async ({ page }) => {
    await seedStorage(page, { [KEYS.primary]: CORRUPT, [KEYS.backup1]: backupSave() });
    await page.goto('/');

    await expect(sheet(page)).toBeVisible();
    await expect(sheet(page).locator('[data-sheet-headline]')).toHaveText("THIS SAVE COULDN'T BE READ.");
    await expect(sheet(page).locator('[data-action="load-backup"]')).not.toHaveAttribute('aria-disabled', 'true');
    expect(await stored(page, KEYS.unreadable)).toBe(CORRUPT);

    // A reload fires beforeunload, which saves; the damaged save must survive it.
    await page.reload();
    await expect(sheet(page)).toBeVisible();
    expect(await stored(page, KEYS.primary)).toBe(CORRUPT);

    await Promise.all([page.waitForEvent('load'), sheet(page).locator('[data-action="load-backup"]').click()]);
    await expect(page.locator('[data-shell]')).toBeVisible();
    await expect(sheet(page)).toHaveCount(0);
    const workers = await page.evaluate(
      () => (window as unknown as { __swarm: { manager: { getState(): { resources: { workers: number } } } } }).__swarm.manager.getState().resources.workers,
    );
    expect(workers).toBe(3);
    expect(await stored(page, KEYS.unreadable)).toBe(CORRUPT);
  });

  test('from a newer version, with no backup, waits for a held START OVER', async ({ page }) => {
    const future = FUTURE_VERSION;
    await seedStorage(page, { [KEYS.primary]: future });
    await page.goto('/');

    await expect(sheet(page)).toBeVisible();
    await expect(sheet(page).locator('[data-action="load-backup"]')).toHaveAttribute('aria-disabled', 'true');
    expect(await stored(page, KEYS.primary)).toBe(future);

    const holdMs = await page.evaluate(
      () =>
        (window as unknown as { __swarm: { platform: { settings: { settings: { value: { confirmHoldMs: number } } } } } }).__swarm
          .platform.settings.settings.value.confirmHoldMs,
    );
    const startOver = sheet(page).locator('[data-action="start-over"]');
    // A plain tap does nothing: START OVER is irreversible.
    await startOver.click();
    await expect(sheet(page)).toBeVisible();
    expect(await stored(page, KEYS.primary)).toBe(future);
    // Held for the full confirm time, it fires (and the sheet closes while still held).
    await startOver.dispatchEvent('pointerdown', { pointerId: 1, button: 0, isPrimary: true });
    await expect(sheet(page)).toHaveCount(0, { timeout: holdMs + 5000 });
    const primary = JSON.parse((await stored(page, KEYS.primary))!) as { version: number };
    expect(primary.version).toBeLessThan(999);
    expect(await stored(page, KEYS.unreadable)).toBe(future);
  });
});

test('a failing write shows SAVE FAILED until a write works, and keeps the last good save', async ({ page }) => {
  await seedStorage(page, { [KEYS.primary]: backupSave() });
  // Storage refuses writes to the primary while `refuse-save` is set in sessionStorage.
  await page.addInitScript(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === 'the_swarm_save' && sessionStorage.getItem('refuse-save')) throw new DOMException('full', 'QuotaExceededError');
      return setItem.call(this, key, value);
    };
  });
  await page.goto('/');
  await expect(page.locator('[data-shell]')).toBeVisible();
  const good = await stored(page, KEYS.primary);

  type Swarm = { __swarm: { saveManager: { save(s: unknown, t: number, f: boolean): boolean }; manager: { getState(): unknown } } };
  const forceSave = () =>
    page.evaluate(() => {
      const w = window as unknown as Swarm;
      return w.__swarm.saveManager.save(w.__swarm.manager.getState(), 0, true);
    });

  await page.evaluate(() => sessionStorage.setItem('refuse-save', '1'));
  expect(await forceSave()).toBe(false);
  const marker = page.locator('[data-save-failed]');
  await expect(marker).toBeVisible();
  expect(await stored(page, KEYS.primary)).toBe(good);

  await marker.click();
  const explain = page.locator('[data-save-failed-sheet]');
  await expect(explain).toBeVisible();
  await expect(explain.locator('[data-action="export-save"]')).toBeVisible();
  await explain.locator('[data-sheet-close]').click();

  await page.evaluate(() => sessionStorage.removeItem('refuse-save'));
  expect(await forceSave()).toBe(true);
  await expect(marker).toHaveCount(0);
});
