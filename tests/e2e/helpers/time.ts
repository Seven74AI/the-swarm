import { expect, type Page } from '@playwright/test';

/**
 * Condition-based waits for "nothing happens" checks (#369), instead of `waitForTimeout`.
 *
 * The game ticks on animation frames, so letting frames render is what gives a
 * wrong change the chance to show up; a fixed wall-clock sleep is only a guess
 * at that. Prefer `gameTimePasses` when the simulation runs, `frames` when it
 * is meant to be stopped (paused, hidden, behind a modal sheet).
 */

/** Resolves after the page has rendered `n` animation frames. */
export async function frames(page: Page, n: number): Promise<void> {
  await page.evaluate(
    (count) =>
      new Promise<void>((resolve) => {
        let seen = 0;
        const step = () => (++seen >= count ? resolve() : requestAnimationFrame(step));
        requestAnimationFrame(step);
      }),
    n,
  );
}

const playTimeMs = (page: Page): Promise<number> =>
  page.evaluate(
    () => (window as unknown as { __swarm: { manager: { getState(): { stats: { playTimeMs: number } } } } }).__swarm.manager.getState().stats.playTimeMs,
  );

/** Resolves once the simulation has advanced at least `ms` of game time (`stats.playTimeMs`). */
export async function gameTimePasses(page: Page, ms: number): Promise<void> {
  const start = await playTimeMs(page);
  await expect.poll(() => playTimeMs(page), { timeout: Math.max(10_000, ms * 5) }).toBeGreaterThanOrEqual(start + ms);
}
