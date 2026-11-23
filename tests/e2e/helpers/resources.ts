import { expect, type Page } from '@playwright/test';

/**
 * Story 1.16: the strip shows only the phase's resources (eggs and larvae leave
 * it in Colony). Every unlocked resource, with its exact integer, is in the
 * resource sheet the strip opens. These read a resource there and close the
 * sheet again, so the tab bar and primary zone are free afterwards.
 */

const sheet = (page: Page) => page.locator('[data-resource-sheet]');

export async function openResourceSheet(page: Page): Promise<void> {
  if (await sheet(page).isVisible()) return;
  await page.locator('[data-resource-strip]').click();
  await expect(sheet(page)).toBeVisible();
}

export async function closeResourceSheet(page: Page): Promise<void> {
  if (!(await sheet(page).isVisible())) return;
  await sheet(page).locator('[data-sheet-close]').click();
  await expect(sheet(page)).toHaveCount(0);
}

/** The exact amount the resource sheet shows (grouping stripped). */
export async function readResource(page: Page, id: string): Promise<number> {
  await openResourceSheet(page);
  const cell = sheet(page).locator(`[data-resource-row="${id}"] [data-col="amount"]`);
  // Past the threshold the rows group by tier, a quiet group collapsed (Story 9.10): open the one holding it.
  const group = sheet(page).locator(`[data-resource-group]:has([data-resource-row="${id}"])[data-open="false"]`);
  if ((await group.count()) > 0) await group.locator('[data-action="toggle-group"]').click();
  await expect(cell).toBeVisible();
  const text = (await cell.textContent()) ?? '';
  await closeResourceSheet(page);
  return Number(text.replace(/[^0-9]/g, ''));
}
