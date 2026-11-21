import { expect, type Page } from '@playwright/test';
import { openTab } from './tabs';

/**
 * Commit a met phase goal (Story 1.19): the phase never changes on its own.
 * Waits for the goal to latch, opens NEST if the tab bar is shown, and taps
 * `> CONTINUE` (`[data-action="continue"]`). Behind an open sheet or overlay it
 * presses the button programmatically, like `openTab`.
 */
export async function tapContinue(page: Page, timeout = 15_000): Promise<void> {
  const cont = page.locator('[data-action="continue"]');
  await expect(cont).toHaveCount(1, { timeout });
  if (await page.locator('[data-tab-bar]').isVisible()) await openTab(page, 'nest');
  await expect(cont).toBeVisible();
  const phase = () =>
    page.evaluate(() => {
      const swarm = (window as unknown as { __swarm: { manager: { getState(): { phase: string } } } }).__swarm;
      return swarm.manager.getState().phase;
    });
  const before = await phase();
  const press = () =>
    cont.evaluate((el) => {
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, button: 0 }));
      el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, button: 0 }));
    });
  if (await page.locator('[data-sheet="modal"]').isVisible()) {
    await press();
  } else {
    // A sheet or the onboarding tooltip can cover it; then press it programmatically.
    await cont.click({ timeout: 3_000 }).catch(press);
  }
  // The next phase's goal may latch at once, bringing CONTINUE back: wait for the phase instead.
  await expect.poll(phase).not.toBe(before);
}
