import { test, expect } from '@playwright/test';

/**
 * E2E: a bug in a tick never corrupts the run (Story 1.17, AR16).
 *
 * A system is made to throw from the page. Three failed ticks in a row stop the
 * simulation and open a sheet with EXPORT SAVE and RELOAD; the colony's state
 * stays the last good snapshot, and so does the save.
 */

interface SwarmWindow {
  __swarm: {
    resourceSystem: { tick: (...args: unknown[]) => unknown };
    loop: { isHalted(): boolean };
    manager: { getState(): { stats: { playTimeMs: number } } };
  };
}

test('three failed ticks stop the colony and offer EXPORT SAVE and RELOAD', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as unknown as SwarmWindow).__swarm?.manager.getState().stats.playTimeMs > 0);

  const before = await page.evaluate(() => {
    const swarm = (window as unknown as SwarmWindow).__swarm;
    swarm.resourceSystem.tick = () => {
      throw new Error('e2e: stubbed system bug');
    };
    return swarm.manager.getState().stats.playTimeMs;
  });

  const sheet = page.locator('[data-tick-failure]');
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('[data-action="export-save"]')).toBeVisible();
  await expect(sheet.locator('[data-action="reload"]')).toBeVisible();

  const after = await page.evaluate(() => {
    const swarm = (window as unknown as SwarmWindow).__swarm;
    return { halted: swarm.loop.isHalted(), playTimeMs: swarm.manager.getState().stats.playTimeMs };
  });
  expect(after.halted).toBe(true);
  // The failing ticks wrote nothing: play time stopped where the last good tick left it.
  expect(after.playTimeMs).toBeGreaterThanOrEqual(before);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('the_swarm_save')!).gameState.stats.playTimeMs);
  expect(saved).toBe(after.playTimeMs);

  // EXPORT SAVE offers the save as a file.
  const download = page.waitForEvent('download');
  await sheet.locator('[data-action="export-save"]').click();
  expect((await download).suggestedFilename()).toBe('the-swarm-save.json');

  // RELOAD restarts the page, and the colony runs again from the kept save.
  await sheet.locator('[data-action="reload"]').click();
  await page.waitForFunction(() => {
    const swarm = (window as unknown as SwarmWindow).__swarm;
    return swarm && !swarm.loop.isHalted() && swarm.manager.getState().stats.playTimeMs > 0;
  });
  await expect(page.locator('[data-tick-failure]')).toHaveCount(0);
});
