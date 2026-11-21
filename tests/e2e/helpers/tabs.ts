import { expect, type Locator, type Page } from '@playwright/test';

export type TabId = 'nest' | 'wrkr' | 'build' | 'front' | 'log';
export type SegmentId = 'war' | 'map' | 'stars';

/**
 * Tap a tab-bar or segment button. Sheets (Story 1.14) cover the bottom of the
 * screen, where the tab bar is; specs that only need a panel behind an open
 * decision or offline sheet press the button programmatically instead of
 * tapping through the sheet. tab-shell.spec.ts covers real taps.
 */
async function press(page: Page, button: Locator): Promise<void> {
  if ((await button.getAttribute('aria-selected')) === 'true') return;
  if (await page.locator('[data-sheet="modal"]').isVisible()) {
    await button.evaluate((el) => (el as HTMLElement).click());
  } else {
    // A sheet can open between the check and the tap; then press it programmatically.
    await button.click({ timeout: 3_000 }).catch(() => button.evaluate((el) => (el as HTMLElement).click()));
  }
  await expect(button).toHaveAttribute('aria-selected', 'true');
}

/**
 * Open a tab of the tab shell (Story 1.15), and a FRONT segment if given.
 * Legacy panels live inside their tab and are hidden while another tab is open.
 */
export async function openTab(page: Page, tab: TabId, segment?: SegmentId): Promise<void> {
  const button = page.locator(`[data-tab="${tab}"]`);
  await expect(button).toBeVisible({ timeout: 10_000 });
  await press(page, button);
  if (segment) {
    const seg = page.locator(`[data-segment="${segment}"]`);
    await expect(seg).toBeVisible({ timeout: 10_000 });
    await press(page, seg);
  }
}
