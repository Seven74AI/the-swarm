import { test, expect, type Page } from '@playwright/test';

/**
 * Story 1.10: settings are a platform service under their own key, outside the save.
 * The boot exposes `window.__swarm.platform` (bootstrap's return value).
 */

const settingsOf = (page: Page) =>
  page.evaluate(() => (window as any).__swarm.platform.settings.settings.value as Record<string, unknown>);

test('boots with default settings when no settings key exists', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__swarm?.platform);
  const s = await settingsOf(page);
  expect(s).toMatchObject({ sound: false, crt: 'scene', confirmStyle: 'hold', layMode: 'hold', keyboardShortcuts: true });
  expect(await page.evaluate(() => (window as any).__swarm.audio.muted)).toBe(true);
});

test('stored settings load at boot and never enter the save', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('the_swarm_settings', JSON.stringify({ version: 1, settings: { sound: true, layMode: 'toggle' } }));
  });
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__swarm?.platform);
  expect(await settingsOf(page)).toMatchObject({ sound: true, layMode: 'toggle' });
  expect(await page.evaluate(() => (window as any).__swarm.audio.muted)).toBe(false);

  await page.evaluate(() => {
    const s = (window as any).__swarm;
    s.saveManager.save(s.manager.getState(), 0, true);
  });
  const save = await page.evaluate(() => localStorage.getItem('the_swarm_save') ?? '');
  expect(save).not.toBe('');
  expect(save).not.toContain('the_swarm_settings');
  expect(JSON.parse(save).gameState).not.toHaveProperty('settings');

  await page.reload();
  await page.waitForFunction(() => (window as any).__swarm?.platform);
  expect(await settingsOf(page)).toMatchObject({ sound: true, layMode: 'toggle' });
});

/**
 * Story 1.27: the settings screen, reached in Phase 1 from the resource sheet's
 * [ SETTINGS ⚙ ]. Every change is in the store, and under its key, at once.
 */
async function openSettingsScreen(page: Page): Promise<void> {
  await page.locator('[data-resource-strip]').click();
  await expect(page.locator('[data-resource-sheet]')).toBeVisible();
  await page.locator('[data-resource-sheet] [data-action="settings"]').click();
  await expect(page.locator('[data-settings-sheet]')).toBeVisible();
  await expect(page.locator('[data-resource-sheet]')).toHaveCount(0);
}

// The onboarding tutorial would cover the strip.
const skipOnboarding = (page: Page) =>
  page.addInitScript(() => localStorage.setItem('the_swarm_onboarding', 'done'));

const storedSettings = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('the_swarm_settings') ?? '{}').settings ?? {});

test('the settings screen opens from the resource sheet in Phase 1 and writes each change at once', async ({ page }) => {
  await skipOnboarding(page);
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__swarm?.platform);
  await openSettingsScreen(page);

  const sound = page.locator('[data-setting="sound"] [data-option="true"]');
  await sound.click();
  await expect(sound).toHaveAttribute('aria-pressed', 'true');
  expect(await settingsOf(page)).toMatchObject({ sound: true });
  expect(await storedSettings(page)).toMatchObject({ sound: true });
  expect(await page.evaluate(() => (window as any).__swarm.audio.muted)).toBe(false);

  await page.locator('[data-setting="crt"] [data-option="full"]').click();
  await expect(page.locator('[data-setting="crt"]')).toContainText('CONTRAST');
  expect(await storedSettings(page)).toMatchObject({ crt: 'full' });
  await expect(page.locator('[data-settings-sheet]')).not.toContainText(/notif/i);

  await page.reload();
  await page.waitForFunction(() => (window as any).__swarm?.platform);
  await openSettingsScreen(page);
  await expect(page.locator('[data-setting="sound"] [data-option="true"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-setting="crt"] [data-option="full"]')).toHaveAttribute('aria-pressed', 'true');
});

test('a shortcut is remapped by tapping it and pressing the new key, Esc included, without closing the sheet', async ({ page }) => {
  await skipOnboarding(page);
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__swarm?.platform);
  await openSettingsScreen(page);
  const pause = page.locator('[data-shortcut="pause"]');
  await pause.click();
  await expect(pause).toHaveAttribute('data-listening', 'true');
  await page.keyboard.press('k');
  await expect(pause).toHaveAttribute('data-listening', 'false');
  await expect(pause).toContainText('K');
  expect(((await storedSettings(page)).keyBindings ?? {}).pause).toBe('k');

  // Esc pressed while a remap listens is the new key, not a close.
  await pause.click();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-settings-sheet]')).toBeVisible();
  const keys = (await storedSettings(page)).keyBindings ?? {};
  expect(keys.pause).toBe('Escape');
  expect(new Set(Object.values(keys)).size).toBe(Object.values(keys).length);
});

test('export diagnostics downloads a file with the log and the save', async ({ page }) => {
  await skipOnboarding(page);
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__swarm?.platform);
  await openSettingsScreen(page);
  const download = page.waitForEvent('download');
  await page.locator('[data-settings-sheet] [data-action="export-diagnostics"]').click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/diagnostics.*\.json$/);
  const path = await file.path();
  const { readFileSync } = await import('node:fs');
  const data = JSON.parse(readFileSync(path, 'utf8'));
  expect(Array.isArray(data.log)).toBe(true);
  expect(data.save).toHaveProperty('gameState');
  expect(data.settings).toHaveProperty('sound');
});
