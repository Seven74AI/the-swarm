import { test, expect } from '@playwright/test';

test('click egg button spawns visible floating particle', async ({ page }) => {
  await page.goto('/');

  // Click the egg button
  const button = page.locator('#click-egg');
  await button.click();

  // A click-particle should appear
  const particle = page.locator('.click-particle');
  await expect(particle.first()).toBeVisible({ timeout: 1000 });

  // Should contain "+1" and egg emoji
  await expect(particle.first()).toContainText('+1');
  await expect(particle.first()).toContainText('🥚');
});

test('click egg button spawns burst particles', async ({ page }) => {
  await page.goto('/');

  // No burst particles before click
  await expect(page.locator('.burst-particle')).toHaveCount(0);

  // Click the egg button
  await page.locator('#click-egg').click();

  // Burst particles should appear (fixed position, in body)
  const burst = page.locator('.burst-particle');
  await expect(burst.first()).toBeVisible({ timeout: 500 });

  // Multiple burst particles should spawn
  const count = await burst.count();
  expect(count).toBeGreaterThan(1);
});

test('resource increment triggers smooth tween animation', async ({ page }) => {
  await page.goto('/');

  // Verify the egg display exists (critical-bar format)
  const eggDisplay = page.locator('[data-stat="resources.eggs"]');
  await expect(eggDisplay).toBeVisible();

  // The display should contain a critical-value child with the number
  const textEl = eggDisplay.locator('.critical-value');
  await expect(textEl).toBeVisible();

  // Click to increment eggs
  await page.locator('#click-egg').click();

  // Wait for tween (300ms + buffer)
  await page.waitForTimeout(500);

  // The value should NOT be 0 anymore
  await expect(textEl).not.toHaveText('0');
});
