import { test, expect, type Page } from '@playwright/test';

/**
 * E2E: decision events (GM-2, Story 1.28, N3).
 *
 * - An event never spawns on load: a long-played save opens nothing in the
 *   first seconds (the spawn waits for 2 min of foreground play this session).
 * - An open event lives in the save (`state.decision.open`): it opens as a
 *   decision sheet on load, shows the situation, two choices, a timer meter and
 *   the IGNORE line, and comes back after a reload with its time left.
 * - A choice closes it; the colony keeps running underneath.
 * - A costly timeout writes the outcome to the log and toasts once.
 * - The decision-timer setting (Story 1.27) is honoured: OFF stops the countdown.
 *
 * Saves are seeded as partial states; SaveManager.load() migrates and
 * deep-merges them. The seed is guarded by sessionStorage so a reload keeps the
 * game's own save (pattern from log-tab.spec).
 */

interface OpenSeed {
  id: 'beetle_sighting' | 'overcrowding' | 'scout_report';
  remainingMs: number | null;
}

type Swarm = {
  manager: { getState(): { decision: { open: { id: string; remainingMs: number | null } | null }; resources: { food: number }; stats: { playTimeMs: number; totalClicks: number } } };
  platform: { settings: { update(patch: Record<string, unknown>): void } };
};

async function seed(page: Page, open: OpenSeed | null, extra: Record<string, unknown> = {}): Promise<void> {
  const gameState = {
    phase: 'colony',
    resources: { eggs: 0, larvae: 0, workers: 10, food: 400, nestCapacity: 50 },
    workersAssigned: { gather: 6, tend: 2, dig: 1, guard: 1, researchers: 0 },
    stats: { totalEggsLaid: 30, totalClicks: 30, playTimeMs: 10 * 3_600_000 },
    lastSaveTimestamp: Date.now(),
    decision: { open: open && { ...open, openedAtSessionMs: 0, roll: 0.99 }, nextSpawnSessionMs: 0 },
    ...extra,
  };
  await page.addInitScript((save: string) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('the_swarm_save', save);
    localStorage.setItem('the_swarm_onboarding', 'complete');
  }, JSON.stringify({ version: 17, timestamp: Date.now(), playTimeMs: 10 * 3_600_000, gameState }));
  await page.goto('/');
  await page.waitForSelector('#panels', { timeout: 10_000 });
}

const popup = (page: Page) => page.locator('#decision-popup');
const openDecision = (page: Page) =>
  page.evaluate(() => (window as unknown as { __swarm: Swarm }).__swarm.manager.getState().decision.open);

test.describe('Decision events (Story 1.28)', () => {
  test('a long-played save spawns no event on load', async ({ page }) => {
    await seed(page, null);
    // Give the ticks well over a second: the old popup opened at once here.
    await page.waitForTimeout(2000);
    await expect(popup(page)).toHaveCount(0);
    expect(await openDecision(page)).toBeNull();
  });

  test('an open event from the save shows its situation, two choices, the timer and the IGNORE line', async ({ page }) => {
    await seed(page, { id: 'overcrowding', remainingMs: 40_000 });
    await expect(popup(page)).toBeVisible({ timeout: 10_000 });
    await expect(popup(page).locator('.decision-popup-title')).not.toBeEmpty();
    await expect(popup(page).locator('.decision-popup-desc')).not.toBeEmpty();
    await expect(popup(page).locator('button[data-choice]')).toHaveCount(2);
    await expect(popup(page).locator('[data-decision-timer] [role="progressbar"]')).toBeVisible();
    await expect(popup(page).locator('[data-ignore-line]')).toContainText('IGNORE:');
    await expect(popup(page).locator('[data-sheet-close]')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(popup(page)).toBeVisible();
  });

  test('the first timed event says timers can be slowed, once', async ({ page }) => {
    await seed(page, { id: 'overcrowding', remainingMs: 40_000 });
    await expect(popup(page).locator('[data-timer-hint]')).toHaveText('TIMERS CAN BE SLOWED IN SETTINGS', { timeout: 10_000 });
    await page.reload();
    await expect(popup(page)).toBeVisible({ timeout: 10_000 });
    await expect(popup(page).locator('[data-timer-hint]')).toHaveCount(0);
  });

  test('a choice closes the event; the colony keeps running underneath', async ({ page }) => {
    await seed(page, { id: 'beetle_sighting', remainingMs: 25_000 });
    await expect(popup(page)).toBeVisible({ timeout: 10_000 });

    const playTime = () => page.evaluate(() => (window as unknown as { __swarm: Swarm }).__swarm.manager.getState().stats.playTimeMs);
    const before = await playTime();
    await expect.poll(playTime, { timeout: 5_000 }).toBeGreaterThan(before);

    await popup(page).locator('button[data-choice]').first().click();
    await expect(popup(page)).toHaveCount(0);
    expect(await openDecision(page)).toBeNull();
  });

  test('an open event survives a reload with its time left', async ({ page }) => {
    await seed(page, { id: 'overcrowding', remainingMs: 40_000 });
    await expect(popup(page)).toBeVisible({ timeout: 10_000 });
    const before = (await openDecision(page))!.remainingMs!;
    expect(before).toBeLessThanOrEqual(40_000);
    await page.reload();
    await expect(popup(page)).toBeVisible({ timeout: 10_000 });
    const after = (await openDecision(page))!;
    expect(after.id).toBe('overcrowding');
    expect(after.remainingMs!).toBeGreaterThan(0);
    // Saved on unload and paused while away: at most the foreground seconds since then are gone.
    expect(after.remainingMs!).toBeGreaterThan(before - 5_000);
  });

  test('the decision-timer setting OFF stops the countdown', async ({ page }) => {
    await seed(page, { id: 'overcrowding', remainingMs: 40_000 });
    await expect(popup(page)).toBeVisible({ timeout: 10_000 });
    await page.evaluate(() => (window as unknown as { __swarm: Swarm }).__swarm.platform.settings.update({ decisionTimers: 'off' }));
    await expect(popup(page).locator('[data-decision-timer]')).toHaveCount(0);
    const held = (await openDecision(page))!.remainingMs;
    await page.waitForTimeout(1000);
    expect((await openDecision(page))!.remainingMs).toBe(held);
  });

  test('a costly timeout applies its outcome, writes it to the log and toasts it', async ({ page }) => {
    await seed(page, { id: 'overcrowding', remainingMs: 600 });
    const food = () => page.evaluate(() => (window as unknown as { __swarm: Swarm }).__swarm.manager.getState().resources.food);
    await expect(popup(page)).toBeVisible({ timeout: 10_000 });
    await expect(popup(page)).toHaveCount(0, { timeout: 5_000 });
    expect(await openDecision(page)).toBeNull();
    await expect(page.locator('[data-toast]')).toContainText('IGNORED');
    await expect(page.locator('#activity-log')).toContainText('IGNORED');
    expect(await food()).toBeGreaterThanOrEqual(0);
  });

  test('an unavoidable event has no timer and no IGNORE line', async ({ page }) => {
    await seed(page, { id: 'scout_report', remainingMs: null }, { phase: 'expansion' });
    await expect(popup(page)).toBeVisible({ timeout: 10_000 });
    await expect(popup(page).locator('[data-decision-timer]')).toHaveCount(0);
    await expect(popup(page).locator('[data-ignore-line]')).toHaveCount(0);
  });
});
