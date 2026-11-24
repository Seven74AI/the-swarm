import { test, expect, type Page } from '@playwright/test';
import { settleReveals } from './helpers/reveal';

/**
 * Story 9.14 (FR59, FR63): a room opened by a DIG press offers a one-tap job
 * choice, a peek that never blocks DIG; NEST lists the plain rooms and a way
 * to assign them later. Seeded with a Colony save past the real Egg Laying
 * guard, below Colony's own goal, with the current room's dig points already
 * in (any press opens it).
 */
const COLONY = {
  phase: 'colony',
  resources: { eggs: 4, larvae: 2, workers: 30, food: 5_000, nestCapacity: 40, wood: 100, stone: 0, nectar: 0 },
  eggPipeline: { count: 4, progress: 0 },
  larvaPipeline: { count: 2, progress: 0 },
  // Nobody on DIG: only a press opens the room (the diggers' own rooms open plain, with no choice).
  workersAssigned: { gather: 20, forage: 0, tend: 0, dig: 0, guard: 1, researchers: 0 },
  dig: { roomsDug: 3, progress: 999_999, carry: 0, roomsByHand: 3, auto: false },
  roomJobs: { jobs: { gallery: 0 }, fresh: 0 },
};

async function seed(page: Page): Promise<void> {
  await page.addInitScript((save) => {
    localStorage.setItem('the_swarm_onboarding', 'done');
    localStorage.setItem('the_swarm_save', save);
  }, JSON.stringify({ version: 38, timestamp: Date.now(), playTimeMs: 0, gameState: COLONY }));
  await page.goto('/');
  await expect(page.locator('[data-tab-panel="nest"]')).toBeVisible();
  await expect(page.locator('[data-room-jobs]')).toBeVisible();
  await settleReveals(page);
}

test.describe('room jobs (Story 9.14)', () => {
  test.beforeEach(async ({ page }) => seed(page));

  test('a press that opens a room offers GALLERY or PLAIN as a peek, and DIG still works under it', async ({ page }) => {
    await expect(page.locator('[data-room-jobs]')).toContainText('3 PLAIN ROOMS');
    const dig = page.locator('[data-nest-primary="dig"] button');
    await dig.click();
    const choice = page.locator('[data-room-job-choice]');
    await expect(choice).toBeVisible();
    await expect(choice).toContainText('ROOM OPENED');
    await expect(page.locator('[data-sheet="modal"]')).toHaveCount(0);
    // DIG is not blocked: the choice covers nothing it needs (a click on a covered button fails here).
    await dig.click();
    await expect(choice).toBeVisible();
    await page.locator('[data-room-job-pick="gallery"]').click();
    await expect(page.locator('[data-room-jobs]')).toContainText('1 GALLERY');
  });

  test('ROOMS opens the room jobs sheet, where a fresh room takes a job for free', async ({ page }) => {
    await page.locator('[data-nest-primary="dig"] button').click();
    await page.locator('[data-room-job-pick="plain"]').click();
    await page.locator('[data-room-jobs-assign]').click();
    const sheet = page.locator('[data-room-jobs-sheet]');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('[data-room-job-row="gallery"]')).toContainText('FREE');
    await sheet.locator('[data-room-job-add="gallery"]').click();
    await expect(page.locator('[data-room-jobs]')).toContainText('1 GALLERY');
  });
});
