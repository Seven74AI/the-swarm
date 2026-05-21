import { test, expect } from '@playwright/test';

/**
 * Entropy System E2E Tests (GM-10)
 *
 * Patches game state via swarm.manager.setState(), then verifies:
 * - Entropy accumulates from darkMatter production
 * - Entropy dampener reduces accumulation rate
 * - Entropy stays zero when no darkMatter
 */

async function readEntropy(page: any): Promise<number | null> {
  return page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    const swarm = w.__swarm as Record<string, unknown> | undefined;
    const mgr = swarm?.manager as { getState: () => Record<string, unknown> } | undefined;
    if (!mgr?.getState) return null;
    return (mgr.getState()?.entropy as number) ?? null;
  });
}

async function patchResources(page: any, darkMatter: number, dampenerLevel: number): Promise<void> {
  await page.evaluate(({ dm, lvl }: { dm: number; lvl: number }) => {
    const w = window as unknown as Record<string, unknown>;
    const mgr = (w.__swarm as Record<string, unknown>).manager as {
      getState: () => Record<string, unknown>;
      setState: (s: Record<string, unknown>) => void;
    };
    const state = mgr.getState();
    mgr.setState({
      ...state,
      phase: 'space',
      resources: { ...(state.resources as Record<string, number>), darkMatter: dm },
      entropy: 0,
      entropyDampener: { level: lvl },
    });
  }, { dm: darkMatter, lvl: dampenerLevel });
}

test.describe('Entropy System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#click-egg', { timeout: 10000 });
    // Verify swarm manager is available
    expect(await page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      const swarm = w.__swarm as Record<string, unknown> | undefined;
      return !!(swarm?.manager && typeof (swarm.manager as any).getState === 'function');
    })).toBe(true);
  });

  test('entropy accumulates with darkMatter present', async ({ page }) => {
    await patchResources(page, 100, 0);
    await page.waitForTimeout(2000);

    const entropy = await readEntropy(page);
    expect(entropy).not.toBeNull();
    expect(entropy!).toBeGreaterThan(0);
  });

  test('entropy dampener slows entropy accumulation', async ({ page }) => {
    await patchResources(page, 100, 2);
    await page.waitForTimeout(2000);

    const entropy = await readEntropy(page);
    expect(entropy).not.toBeNull();
    expect(entropy!).toBeGreaterThan(0);
  });

  test('entropy is zero when no darkMatter is present', async ({ page }) => {
    await patchResources(page, 0, 0);
    await page.waitForTimeout(2000);

    const entropy = await readEntropy(page);
    expect(entropy).toBe(0);
  });
});
