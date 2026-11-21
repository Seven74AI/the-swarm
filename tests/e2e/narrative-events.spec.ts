import { test, expect } from '@playwright/test';

test.describe('Narrative Event Log', () => {
  test('shows narrative flavor text after phase change', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => (window as unknown as { __swarm?: { bus?: unknown } }).__swarm?.bus !== undefined);

    const log = page.locator('#activity-log');
    await expect(log).toBeVisible({ timeout: 5000 });

    // Emit phase_committed (Story 1.19) with lowercase phase names to match the EventLog handler
    await page.evaluate(() => {
      const swarm = (window as unknown as Record<string, unknown>).__swarm as Record<string, unknown>;
      const bus = swarm.bus as { emit: (event: string, payload: unknown) => void };
      bus.emit('phase_committed', { from: 'expansion', to: 'space' });
    });

    // EventLog says "THE SWARM LOOKS TO THE STARS." on space phase
    await expect(log).toContainText('THE SWARM LOOKS TO THE STARS');
  });

  test('shows narrative flavor text for worker count changes', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => (window as unknown as { __swarm?: { bus?: unknown } }).__swarm?.bus !== undefined);

    const log = page.locator('#activity-log');
    await expect(log).toBeVisible({ timeout: 5000 });

    // Emit workers_changed — EventLog shows "THE FIRST WORKER STIRS." on first call
    await page.evaluate(() => {
      const swarm = (window as unknown as Record<string, unknown>).__swarm as Record<string, unknown>;
      const bus = swarm.bus as { emit: (event: string, payload: unknown) => void };
      bus.emit('workers_changed', { workers: 50 });
    });

    // EventLog should have some worker-related entry
    await expect(log).toContainText('WORKER');
  });

  test('shows narrative flavor text for building completion', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => (window as unknown as { __swarm?: { bus?: unknown } }).__swarm?.bus !== undefined);

    const log = page.locator('#activity-log');
    await expect(log).toBeVisible({ timeout: 5000 });

    await page.evaluate(() => {
      const swarm = (window as unknown as Record<string, unknown>).__swarm as Record<string, unknown>;
      const bus = swarm.bus as { emit: (event: string, payload: unknown) => void };
      bus.emit('building_complete', { building: 'barracks', level: 2 });
    });

    // EventLog says "THE BARRACKS REACHES LEVEL 2."
    await expect(log).toContainText('BARRACKS REACHES LEVEL 2');
  });

  test('activity log shows initial narrative message', async ({ page }) => {
    await page.goto('/');

    const log = page.locator('#activity-log');
    await expect(log).toBeVisible({ timeout: 5000 });

    // The initial message should always be present
    await expect(log).toContainText('A QUEEN WAKES ALONE IN THE DARK.');
  });
});
