import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Story 2.11 (AR6, UX-DR32, UX-DR33): export and import the save from settings.
 *
 * - EXPORT SAVE downloads the save (the game state and its chronicle), never the
 *   settings or the intro flag.
 * - IMPORT SAVE of a file that isn't a swarm save shows
 *   `THAT FILE ISN'T A SWARM SAVE.` and changes nothing, in storage or on screen.
 * - A valid file (any shipped version) asks for a hold-to-confirm that says it
 *   replaces the current run; then the game reloads into the imported run.
 *
 * Seeds go in once per test (sessionStorage guard), so the reload after an
 * import sees what the game wrote, not a fresh seed.
 */

const SAVES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'saves');
const KEY = 'the_swarm_save';

/** A well-formed Phase 1 save whose worker count we can recognise. */
function seedSave(workers: number): string {
  return JSON.stringify({
    version: 19,
    timestamp: Date.now(),
    playTimeMs: 0,
    gameState: {
      phase: 'egg_laying',
      lastSaveTimestamp: Date.now(),
      resources: { eggs: 0, larvae: 0, workers, food: 50, nestCapacity: 100 },
    },
  });
}

async function seed(page: Page, save: string): Promise<void> {
  await page.addInitScript((text: string) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('the_swarm_save', text);
    localStorage.setItem('the_swarm_onboarding', 'done');
    localStorage.setItem('the_swarm_settings', JSON.stringify({ version: 3, settings: { layMode: 'toggle' } }));
  }, save);
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__swarm?.platform);
}

async function openSettingsScreen(page: Page): Promise<void> {
  await page.locator('[data-resource-strip]').click();
  await page.locator('[data-resource-sheet] [data-action="settings"]').click();
  await expect(page.locator('[data-settings-sheet]')).toBeVisible();
}

const workers = (page: Page) => page.evaluate(() => (window as any).__swarm.manager.getState().resources.workers as number);
const stored = (page: Page) => page.evaluate((k) => localStorage.getItem(k), KEY);

async function exportSave(page: Page): Promise<string> {
  await openSettingsScreen(page);
  const download = page.waitForEvent('download');
  await page.locator('[data-settings-sheet] [data-action="export-save"]').click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.json$/);
  return fs.readFileSync((await file.path())!, 'utf-8');
}

async function pickImport(page: Page, text: string): Promise<void> {
  await openSettingsScreen(page);
  const chooser = page.waitForEvent('filechooser');
  await page.locator('[data-settings-sheet] [data-action="import-save"]').click();
  await (await chooser).setFiles({ name: 'save.json', mimeType: 'application/json', buffer: Buffer.from(text) });
}

/** Hold REPLACE RUN for the full confirm time, and wait for the page to reload into the import. */
async function confirmImport(page: Page): Promise<void> {
  const sheet = page.locator('[data-import-confirm]');
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText('REPLACES THE CURRENT RUN');
  const replace = sheet.locator('[data-action="confirm-import"]');
  // A plain tap does nothing: the import is irreversible.
  await replace.click();
  await expect(sheet).toBeVisible();
  await page.evaluate(() => ((window as any).__beforeImport = true));
  const holdMs = await page.evaluate(() => (window as any).__swarm.platform.settings.settings.value.confirmHoldMs as number);
  await replace.dispatchEvent('pointerdown', { pointerId: 1, button: 0, isPrimary: true });
  await page.waitForFunction(() => !(window as any).__beforeImport && (window as any).__swarm?.platform, undefined, {
    timeout: holdMs + 10_000,
  });
}

test('EXPORT SAVE downloads the save, without the settings or the intro flag', async ({ page }) => {
  await seed(page, seedSave(7));
  const text = await exportSave(page);
  const data = JSON.parse(text) as { version: number; gameState: { resources: { workers: number } }; chronicle?: unknown };
  expect(data.gameState.resources.workers).toBe(await workers(page));
  expect(data.version).toBe(await page.evaluate(() => (window as any).__swarm.saveManager.constructor.SAVE_VERSION as number));
  expect(data).toHaveProperty('chronicle');
  expect(text).not.toContain('the_swarm_settings');
  expect(text).not.toContain('layMode');
  expect(text).not.toContain('the_swarm_onboarding');
});

test('export → import round-trips: the exported run replaces a changed one after a hold', async ({ page }) => {
  await seed(page, seedSave(7));
  const exported = await exportSave(page);
  await page.keyboard.press('Escape');
  const exportedWorkers = (JSON.parse(exported) as { gameState: { resources: { workers: number } } }).gameState.resources.workers;
  // The run moves on: a different worker count, saved.
  await page.evaluate((n) => {
    const s = (window as any).__swarm;
    const st = s.manager.getState();
    s.manager.setState({ ...st, resources: { ...st.resources, workers: n } });
    s.saveManager.save(s.manager.getState(), 0, true);
  }, exportedWorkers + 40);
  expect(await workers(page)).not.toBe(exportedWorkers);

  await pickImport(page, exported);
  await confirmImport(page);
  expect(await workers(page)).toBe(exportedWorkers);
  // The settings were not touched by the import.
  expect(await page.evaluate(() => (window as any).__swarm.platform.settings.settings.value.layMode)).toBe('toggle');
});

test('KEEP THIS RUN closes the confirm and changes nothing', async ({ page }) => {
  await seed(page, seedSave(7));
  const before = await stored(page);
  await pickImport(page, seedSave(30));
  await page.locator('[data-import-confirm] [data-sheet-close]').click();
  await expect(page.locator('[data-import-confirm]')).toHaveCount(0);
  expect(await workers(page)).toBe(7);
  expect(await stored(page)).toBe(before);
});

for (const file of ['v1.json', fs.readdirSync(SAVES_DIR).filter((f) => /^v\d+\.json$/.test(f)).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1))).pop()!]) {
  test(`a ${file} save imports, migrated to the current version`, async ({ page }) => {
    const text = fs.readFileSync(path.join(SAVES_DIR, file), 'utf-8');
    const phase = (JSON.parse(text) as { gameState: { phase: string } }).gameState.phase;
    await seed(page, seedSave(7));
    await pickImport(page, text);
    await confirmImport(page);
    expect(await page.evaluate(() => (window as any).__swarm.manager.getState().phase)).toBe(phase);
    const savedVersion = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).version as number, KEY);
    expect(savedVersion).toBe(await page.evaluate(() => (window as any).__swarm.saveManager.constructor.SAVE_VERSION as number));
    // Nothing on screen says the save was unreadable.
    await expect(page.locator('[data-unreadable-save]')).toHaveCount(0);
  });
}

for (const [name, text, reason] of [
  ['corrupt JSON', '{"version": 19, "gameState": {"phase": "egg_la', 'not_a_save'],
  ['another app’s JSON', JSON.stringify({ name: 'package', version: '1.0.0' }), 'not_a_save'],
  [
    'a future version',
    JSON.stringify({ version: 999, timestamp: Date.now(), playTimeMs: 0, gameState: { phase: 'egg_laying', resources: {} } }),
    'newer_version',
  ],
] as const) {
  test(`importing ${name} is refused and changes nothing`, async ({ page }) => {
    await seed(page, seedSave(7));
    const before = await stored(page);
    await pickImport(page, text);
    const sheet = page.locator(`[data-import-refused="${reason}"]`);
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('[data-sheet-headline]')).toHaveText("THAT FILE ISN'T A SWARM SAVE.");
    await expect(page.locator('[data-import-confirm]')).toHaveCount(0);
    expect(await stored(page)).toBe(before);
    await sheet.locator('[data-sheet-close]').click();
    await expect(sheet).toHaveCount(0);
    // Still the same run, and it still saves as before.
    expect(await workers(page)).toBe(7);
    expect(await page.evaluate(() => (window as any).__swarm.saveManager.isHeld())).toBe(false);
    await page.reload();
    await page.waitForFunction(() => (window as any).__swarm?.platform);
    expect(await workers(page)).toBe(7);
  });
}
