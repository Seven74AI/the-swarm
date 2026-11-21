import { test, expect, type Page } from '@playwright/test';

/**
 * E2E: Story 1.12 primitives (FR45, UX-DR15, UX-DR17, UX-DR29) on a dev-server
 * harness page (tests/e2e/harness/primitives.html), until game screens adopt them.
 */

const HARNESS = '/the-swarm/tests/e2e/harness/primitives.html';

async function open(page: Page): Promise<void> {
  await page.goto(HARNESS);
  await expect(page.locator('[data-role="gatherer"]')).toBeVisible();
}

const value = (page: Page) =>
  page.locator('[data-stepper-value]').innerText().then((t) => Number(t.replace(/\D/g, '')));
const available = (page: Page) => page.evaluate(() => (window as unknown as { __available: number }).__available);

test.describe('Stepper', () => {
  test('brackets and multipliers are 44 px targets with full names', async ({ page }) => {
    await open(page);
    for (const name of ['Add one gatherer', 'Remove one gatherer', '×1', '×10', '×MAX']) {
      const box = await page.getByRole('button', { name, exact: true }).boundingBox();
      expect(box, name).not.toBeNull();
      expect(box!.width, name).toBeGreaterThanOrEqual(44);
      expect(box!.height, name).toBeGreaterThanOrEqual(44);
    }
  });

  test('a tap applies at once; holding repeats and stops at what is available', async ({ page }) => {
    await open(page);
    const add = page.getByRole('button', { name: 'Add one gatherer' });
    await add.click();
    expect(await value(page)).toBeGreaterThan(0);
    const box = (await add.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await expect.poll(() => value(page), { timeout: 10_000 }).toBe(await available(page));
    await page.waitForTimeout(300);
    await page.mouse.up();
    expect(await value(page)).toBe(await available(page));
    await expect(page.locator('[data-step="add"]')).toHaveAttribute('aria-disabled', 'true');
  });

  test('×MAX goes to either end and never past it', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: '×MAX' }).click();
    await page.locator('[data-step="add"]').click();
    expect(await value(page)).toBe(await available(page));
    await page.locator('[data-step="remove"]').click();
    expect(await value(page)).toBe(0);
  });
});

test.describe('Card, Meter, Toast, CoachMark', () => {
  test('a card shows its shortfall until affordable, then highlights', async ({ page }) => {
    await open(page);
    const card = page.locator('[data-card="nursery"]');
    await expect(card.locator('[data-shortfall]')).toContainText(/needs \d+ more/);
    await page.getByRole('button', { name: '×MAX' }).click();
    await page.locator('[data-step="add"]').click();
    await expect(card.locator('[data-shortfall]')).toHaveCount(0);
    await expect(card).toHaveAttribute('data-highlight', '');
    await expect(card).not.toHaveAttribute('data-highlight', '', { timeout: 5000 });
  });

  test('the meter is a progressbar with value text', async ({ page }) => {
    await open(page);
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuetext', /Gatherers 0 of \d+/);
  });

  test('a toast replaces the earlier one and leaves after about 2 s', async ({ page }) => {
    await open(page);
    await page.evaluate(() => (window as unknown as { __toast: (t: string) => void }).__toast('first'));
    await page.evaluate(() => (window as unknown as { __toast: (t: string) => void }).__toast('second'));
    await expect(page.locator('[data-toast]')).toHaveCount(1);
    await expect(page.locator('[data-toast]')).toHaveText('second');
    await expect(page.locator('[data-toast]')).toHaveCount(0, { timeout: 4000 });
  });

  test('GOT IT dismisses the coach mark once and consumes the tap', async ({ page }) => {
    await open(page);
    await expect(page.locator('[data-coach-mark="lay-egg"]').getByText('Tap to lay an egg.')).toBeVisible();
    const before = await page.evaluate(() => (window as unknown as { __outside: { clicks: number } }).__outside.clicks);
    await page.getByRole('button', { name: /GOT IT/ }).click();
    await expect(page.locator('[data-coach-mark]')).toHaveCount(0);
    const after = await page.evaluate(() => (window as unknown as { __outside: { clicks: number } }).__outside.clicks);
    expect(after).toBe(before);
    const seen = await page.evaluate(
      () => (window as unknown as { __seen: { value: { coachMarksSeen: string[] } } }).__seen.value.coachMarksSeen,
    );
    expect(seen).toContain('lay-egg');
  });

  test('performing the pointed-at action dismisses the coach mark', async ({ page }) => {
    await open(page);
    await expect(page.locator('[data-coach-mark="lay-egg"]').getByText('Tap to lay an egg.')).toBeVisible();
    await page.locator('button[data-action="lay"]').click();
    await expect(page.locator('[data-coach-mark]')).toHaveCount(0);
  });
});
