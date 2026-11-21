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
