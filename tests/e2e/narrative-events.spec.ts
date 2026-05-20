import { test, expect } from '@playwright/test';

test.describe('Narrative Event Log', () => {
  test('shows narrative flavor text after phase change', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    const log = page.locator('#activity-log');
    await expect(log).toBeVisible({ timeout: 5000 });

    // Emit a phase_changed event — EventBus should auto-emit narrative_event
    await page.evaluate(() => {
      const swarm = (window as unknown as Record<string, unknown>).__swarm as Record<string, unknown>;
      const bus = swarm.bus as { emit: (event: string, payload: unknown) => void };
      bus.emit('phase_changed', { phase: 'SPACE' });
    });

    await page.waitForTimeout(500);

    const logText = await log.textContent();
    expect(logText).toBeTruthy();

    // At least one of the phase_changed flavor variants should appear
    const hasNarrative = [
      'The stars... are calling',
      'A new chapter begins',
      'The colony crosses a threshold',
      'Nothing will ever be the same',
      'A pulse runs through every ant',
      'A new age has dawned',
    ].some((phrase) => logText?.includes(phrase));
    expect(hasNarrative).toBe(true);
  });

  test('shows narrative flavor text for worker count changes', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    const log = page.locator('#activity-log');
    await expect(log).toBeVisible({ timeout: 5000 });

    // Emit a workers_changed event — EventBus should auto-emit narrative_event
    await page.evaluate(() => {
      const swarm = (window as unknown as Record<string, unknown>).__swarm as Record<string, unknown>;
      const bus = swarm.bus as { emit: (event: string, payload: unknown) => void };
      bus.emit('workers_changed', { workers: 50 });
    });

    await page.waitForTimeout(500);

    const logText = await log.textContent();
    expect(logText).toBeTruthy();

    // Worker narrative flavors should appear
    const hasWorkerNarrative = [
      'The tunnels echo with industry',
      'The colony pulses with new energy',
      'Every tunnel hums with coordinated effort',
      'The colony is a living machine',
    ].some((phrase) => logText?.includes(phrase));
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

    const hasBuildingNarrative = [
      'A new structure rises from the earth',
      'Stone and earth give way to purpose',
      'Construction finished',
      'Another foundation laid',
    ].some((phrase) => logText?.includes(phrase));
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
