import { test, expect } from '@playwright/test';

test.describe('Narrative Event Log', () => {
  test('shows narrative flavor text after phase change', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    const log = page.locator('#activity-log');
    await expect(log).toBeVisible({ timeout: 5000 });

    // Emit phase_committed (Story 1.19) with lowercase phase names to match the EventLog handler
    await page.evaluate(() => {
      const swarm = (window as unknown as Record<string, unknown>).__swarm as Record<string, unknown>;
      const bus = swarm.bus as { emit: (event: string, payload: unknown) => void };
      bus.emit('phase_committed', { from: 'expansion', to: 'space' });
    });

    await page.waitForTimeout(500);

    const logText = await log.textContent();
    expect(logText).toBeTruthy();

    // EventLog says "THE SWARM LOOKS TO THE STARS." on space phase
    const hasNarrative = logText?.includes('THE SWARM LOOKS TO THE STARS') ?? false;
    expect(hasNarrative).toBe(true);
  });

  test('shows narrative flavor text for worker count changes', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    const log = page.locator('#activity-log');
    await expect(log).toBeVisible({ timeout: 5000 });

    // Emit workers_changed — EventLog shows "THE FIRST WORKER STIRS." on first call
    await page.evaluate(() => {
      const swarm = (window as unknown as Record<string, unknown>).__swarm as Record<string, unknown>;
      const bus = swarm.bus as { emit: (event: string, payload: unknown) => void };
      bus.emit('workers_changed', { workers: 50 });
    });

    await page.waitForTimeout(500);

    const logText = await log.textContent();
    expect(logText).toBeTruthy();

    // EventLog should have some worker-related entry
    const hasWorkerNarrative = logText?.includes('WORKER') ?? false;
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

    // EventLog says "THE BARRACKS REACHES LEVEL 2."
    const hasBuildingNarrative = logText?.includes('BARRACKS REACHES LEVEL 2') ?? false;
    expect(hasBuildingNarrative).toBe(true);
  });

  test('activity log shows initial narrative message', async ({ page }) => {
    await page.goto('/');

    const log = page.locator('#activity-log');
    await expect(log).toBeVisible({ timeout: 5000 });

    // The initial message should always be present
    await expect(log).toContainText('A QUEEN WAKES ALONE IN THE DARK.');
  });
});
