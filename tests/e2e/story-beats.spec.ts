import { test, expect, type Page } from '@playwright/test';
import { NARRATIVE_BEATS } from '../../src/data/content/narrative';
import { narrativeBalance } from '../../src/data/balance/narrative';
import { EGG_TO_COLONY, goalPercent } from '../../src/phases/transitions';
import { createInitialState } from '../../src/state/GameState';

/**
 * Story 4.9 (FR19): when the goal first comes near, the phase's near-goal beat is written to the
 * log, once per run. It is a chronicle milestone, saved with the game, so a reload never repeats it.
 */

const beat = NARRATIVE_BEATS.egg_laying.nearGoal.text;

/** Egg Laying one worker short of its goal (so it never latches), which is past the near-goal threshold. */
function nearGoalSeed() {
  const s = createInitialState();
  const workers = EGG_TO_COLONY.conditions[0].target(s) - 1;
  const gameState = { ...s, resources: { ...s.resources, workers, eggs: 0, larvae: 0 } };
  return { gameState, percent: goalPercent(EGG_TO_COLONY, gameState) };
}

/** Seed once: the init script runs again on reload, and must not overwrite what the game saved. */
async function seed(page: Page): Promise<void> {
  const { gameState } = nearGoalSeed();
  await page.addInitScript((save: string) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('the_swarm_save', save);
  }, JSON.stringify({ version: 17, timestamp: Date.now(), playTimeMs: 0, gameState }));
  await page.goto('/');
  await expect(page.locator('[data-shell]')).toBeVisible();
}

const linesWith = (page: Page, text: string) =>
  page.evaluate(
    (t) =>
      (window as unknown as { __swarm: { chronicle: { entries: { value: { message: string }[] } } } }).__swarm.chronicle.entries.value.filter(
        (e) => e.message === t,
      ).length,
    text,
  );

test.describe('Near-goal story beat', () => {
  test('is written once when the goal comes near, and a reload never repeats it', async ({ page }) => {
    expect(nearGoalSeed().percent).toBeGreaterThanOrEqual(narrativeBalance.nearGoalPercent);
    await seed(page);
    await expect(page.locator('#activity-log')).toContainText(beat);
    expect(await linesWith(page, beat)).toBe(1);

    await page.reload();
    await expect(page.locator('[data-shell]')).toBeVisible();
    await expect(page.locator('#activity-log')).toContainText(beat);
    expect(await linesWith(page, beat)).toBe(1);
  });
});
