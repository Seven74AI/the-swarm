import { test, expect } from '@playwright/test';

test.describe('Narrative Event Log', () => {
  test('shows narrative flavor text after phase change', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    const log = page.locator('#activity-log');
    await expect(log).toBeVisible({ timeout: 5000 });

    // Emit phase_changed with lowercase phase name to match EventLog handler
    await page.evaluate(() => {
      const swarm = (window as unknown as Record<string, unknown>).__swarm as Record<string, unknown>;
      const bus = swarm.bus as { emit: (event: string, payload: unknown) => void };
      bus.emit('phase_changed', { phase: 'space' });
    });

    await page.waitForTimeout(500);

    const logText = await log.textContent();
    expect(logText).toBeTruthy();

    // EventLog says "swarm looks to the stars" on space phase
    const hasNarrative = logText?.includes('swarm looks to the stars') ?? false;
    expect(hasNarrative).toBe(true);
  });

  test('shows narrative flavor text for worker count changes', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    const log = page.locator('#activity-log');
    await expect(log).toBeVisible({ timeout: 5000 });

    // Emit workers_changed — EventLog shows "The first worker emerges" on first call
    await page.evaluate(() => {
      const swarm = (window as unknown as Record<string, unknown>).__swarm as Record<string, unknown>;
      const bus = swarm.bus as { emit: (event: string, payload: unknown) => void };
      bus.emit('workers_changed', { workers: 50 });
    });

    await page.waitForTimeout(500);

    const logText = await log.textContent();
    expect(logText).toBeTruthy();

    // EventLog should have some worker-related entry
    const hasWorkerNarrative = logText?.includes('worker') || logText?.includes('Worker') || logText?.includes('colony') || false;
    expect(hasWorkerNarrative).toBe(true);
  });

  test('shows narrative flavor text for building completion', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    const log = page.locator('#activity-log');
    await expect(log).toBeVisible({ timeout: 5000 });

    await page.evaluate(() => {
      const swarm = (window as unknown as Record<string, unknown>).__swarm as Record<string, unknown>;
      const bus = swarm.bus as { emit: (event: string, payload: unknown) => void };
      bus.emit('building_complete', { building: 'barracks', level: 2 });
    });

    await page.waitForTimeout(500);

    const logText = await log.textContent();
    expect(logText).toBeTruthy();

    // EventLog says "Barracks upgraded to level 2. The colony grows stronger."
    const hasBuildingNarrative = logText?.includes('upgraded') || logText?.includes('Barracks') || false;
    expect(hasBuildingNarrative).toBe(true);
  });

  test('activity log shows initial narrative message', async ({ page }) => {
    await page.goto('/');

    const log = page.locator('#activity-log');
    await expect(log).toBeVisible({ timeout: 5000 });

    // The initial message should always be present
    await expect(log).toContainText('You are an ant queen');
  });
});
