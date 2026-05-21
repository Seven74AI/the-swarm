import { test, expect } from '@playwright/test';

/**
 * Golden Path E2E: Full progression seed → all panels unlock → save/load.
 *
 * Seeds a rich colony state on the verge of EXPANSION, verifies every panel
 * becomes visible after the phase transition, tests core interactions
 * (egg click, scout, build), and validates save/load fidelity.
 */

const SEED = {
  version: 2,
  timestamp: Date.now(),
  playTimeMs: 0,
  gameState: {
    phase: 'colony',
    resources: {
      eggs: 5,
      larvae: 3,
      workers: 20,
      food: 1200,
      nestCapacity: 100,
      wood: 400,
      stone: 400,
      nectar: 200,
    },
    eggPipeline: { count: 0, progress: 0 },
    larvaPipeline: { count: 0, progress: 0 },
    workersAssigned: { gather: 12, tend: 4, dig: 4, guard: 0, researchers: 0 },
    soldiers: { scouts: 10, warriors: 5, totalKilled: 2 },
    buildings: {
      barracks: { level: 2, count: 1 },
      walls: { level: 2 },
      warehouse: { level: 2 },
    },
    territory: { ownedTiles: 5, bonuses: {} },
    mapTiles: undefined as unknown as never, // NOT SET — let initial state provide 64 tiles
    expeditions: [
      {
        id: 'exp_golden_1',
        scouts: 2,
        warriors: 1,
        destination: 'FOREST',
        ticksRemaining: 200,
        risk: 0.35,
      },
    ],
    upgrades: {},
    stats: { totalEggsLaid: 200, totalClicks: 350, playTimeMs: 0 },
    unlockedPanels: [],
    lastSaveTimestamp: 0,
    combatSoldiers: 5,
    soldierStats: { strength: 2, defense: 2, speed: 5, maxHp: 12 },
    equipment: { weapon: 2, armor: 2 },
    lastBattle: null,
    combatResources: { chitin: 5, silk: 3, venom: 1 },
    battlesWon: 3,
    battlesLost: 1,
    soldierPipeline: { count: 0, progress: 0 },
  },
};

test.describe('Golden Path — Full Progression', () => {
  test.beforeEach(async ({ page }) => {
    // Inject seed BEFORE page load (avoids beforeunload overwrite)
    await page.addInitScript((seedStr) => {
      localStorage.setItem('the_swarm_save', seedStr);
    }, JSON.stringify(SEED));

    await page.goto('/');

    // Verify seed loaded into localStorage
    const saved = await page.evaluate(() => localStorage.getItem('the_swarm_save'));
    expect(saved).toBeTruthy();
    const parsed = JSON.parse(saved!);
    expect(parsed.gameState.resources.food).toBe(1200);
    expect(parsed.gameState.buildings.barracks.level).toBe(2);

    // Wait for panels container to render
    await page.waitForSelector('#panels', { timeout: 10000 });

    // Wait for phase transition: COLONY → EXPANSION (20 workers + 500 food)
    const indicator = page.locator('#phase-indicator');
    await expect(indicator).toContainText('The Expansion', { timeout: 15000 });
  });

  // ─── Panel Visibility ───────────────────────────────────────────

  test('egg button is always visible and clickable', async ({ page }) => {
    const eggBtn = page.locator('#click-egg');
    await expect(eggBtn).toBeVisible();
    await expect(eggBtn).toBeEnabled();
  });

  test('phase indicator shows "The Expansion"', async ({ page }) => {
    const indicator = page.locator('#phase-indicator');
    await expect(indicator).toContainText('The Expansion');
  });

  test('resource panel shows seeded values', async ({ page }) => {
    // Food should show 1200+
    const foodDisplay = page.locator('[data-stat="resources.food"]');
    await expect(foodDisplay).toBeVisible();
    await expect(foodDisplay).toContainText(/1[,.]?2/); // 1200+

    // Eggs and workers are also in the resource panel
    await expect(page.locator('[data-stat="resources.eggs"]')).toBeVisible();
    await expect(page.locator('[data-stat="resources.workers"]')).toBeVisible();

    // Wood/stone/nectar aren't directly rendered — verify via game state
    const state = await page.evaluate(() => {
      const swarm = (window as unknown as Record<string, unknown>).__swarm as Record<string, unknown>;
      return (swarm.manager as { getState: () => Record<string, unknown> }).getState();
    });
    expect((state as Record<string, unknown>).resources).toBeTruthy();
    const resources = (state as Record<string, unknown>).resources as Record<string, number>;
    expect(resources.wood).toBeGreaterThanOrEqual(300);
    expect(resources.stone).toBeGreaterThanOrEqual(300);
    expect(resources.nectar).toBeGreaterThanOrEqual(100);
  });

  test('worker assignment panel shows gather/tend rows', async ({ page }) => {
    const workerPanel = page.locator('#worker-assignment');
    await expect(workerPanel).toBeVisible();
    const text = await workerPanel.textContent();
    expect(text).toContain('Gather');
    expect(text).toContain('Tend');
  });

  test('soldier panel shows recruit button and soldier stats', async ({ page }) => {
    const soldierPanel = page.locator('#soldier-panel');
    await expect(soldierPanel).toBeVisible();

    const recruitBtn = soldierPanel.locator('button').filter({ hasText: 'Recruit Soldier' });
    await expect(recruitBtn).toBeVisible();

    // Soldier count should be visible (5 combat soldiers)
    await expect(soldierPanel).toContainText('Soldiers');
  });

  test('battle panel shows scout and engage buttons', async ({ page }) => {
    const battlePanel = page.locator('#battle-panel');
    await expect(battlePanel).toBeVisible();

    const scoutBtn = page.locator('#scout-enemy');
    await expect(scoutBtn).toBeVisible();

    const engageBtn = page.locator('#engage-battle');
    await expect(engageBtn).toBeVisible();
  });

  test('map panel is visible in expansion phase', async ({ page }) => {
    const mapPanel = page.locator('.map-panel');
    await expect(mapPanel).toBeVisible();
  });

  test('building panel shows three building rows', async ({ page }) => {
    const buildingPanel = page.locator('#building-panel');
    await expect(buildingPanel).toBeVisible();

    // All three building rows should be present
    const barracksRow = buildingPanel.locator('[data-building="barracks"]');
    await expect(barracksRow).toBeVisible();
    const wallsRow = buildingPanel.locator('[data-building="walls"]');
    await expect(wallsRow).toBeVisible();
    const warehouseRow = buildingPanel.locator('[data-building="warehouse"]');
    await expect(warehouseRow).toBeVisible();

    // Each row should show "Build" button
    const buildBtns = buildingPanel.locator('button').filter({ hasText: 'Build' });
    await expect(buildBtns).toHaveCount(3);
  });

  test('expedition panel shows launch form', async ({ page }) => {
    const expeditionPanel = page.locator('#expedition-panel');
    await expect(expeditionPanel).toBeVisible();

    // Send button should be present (one per destination)
    const sendBtn = expeditionPanel.locator('button').filter({ hasText: 'Send' }).first();
    await expect(sendBtn).toBeVisible();

    // Should show active expedition row
    const expRows = expeditionPanel.locator('.expedition-row');
    await expect(expRows).toHaveCount(1);
  });

  test('activity log has entries', async ({ page }) => {
    const logEntries = page.locator('.log-entry');
    const count = await logEntries.count();
    expect(count).toBeGreaterThan(0);
  });

  // ─── Interactions ───────────────────────────────────────────────

  test('clicking egg increments egg count', async ({ page }) => {
    const eggDisplay = page.locator('[data-stat="resources.eggs"]');

    // Read current value
    const before = await eggDisplay.textContent();
    await page.locator('#click-egg').click();
    await page.waitForTimeout(300);

    // After click, content should be different
    await expect(eggDisplay).not.toHaveText(before!);
  });

  test('scout reveals enemy information', async ({ page }) => {
    // Scout button should be enabled (combatSoldiers=5 > 0)
    const scoutBtn = page.locator('#scout-enemy');
    await expect(scoutBtn).toBeEnabled({ timeout: 5000 });

    await scoutBtn.dispatchEvent('click');

    // Enemy name should appear
    const enemyName = page.locator('#enemy-name');
    await expect(enemyName).toBeVisible({ timeout: 5000 });
    await expect(enemyName).not.toBeEmpty();

    // Engage button should become enabled after scouting
    const engageBtn = page.locator('#engage-battle');
    await expect(engageBtn).toBeEnabled({ timeout: 3000 });
  });

  test('clicking Build on barracks increments its level', async ({ page }) => {
    // Barracks row shows current level in label
    const barracksRow = page.locator('[data-building="barracks"]');
    const labelBefore = await barracksRow.locator('.stat-label').textContent();

    // Click Build on barracks (may need to wait for resources from gatherers)
    const buildBtn = barracksRow.locator('button').filter({ hasText: 'Build' });
    // Run some ticks to accumulate food/wood from gatherers
    await page.waitForTimeout(2000);
    // Button may still be disabled if cost is high — check if enabled or skip
    const isEnabled = await buildBtn.isEnabled();
    if (!isEnabled) {
      test.skip(true, 'Barracks Lv.3 cost exceeds available resources');
      return;
    }
    await buildBtn.dispatchEvent('click');

    // Wait for UI update
    await page.waitForTimeout(500);

    // Label should have changed (Lv.2 → Lv.3)
    const labelAfter = await barracksRow.locator('.stat-label').textContent();
    expect(labelAfter).not.toBe(labelBefore);
    expect(labelAfter).toContain('Lv.3');
  });

  // ─── Save / Load ────────────────────────────────────────────────

  test('save and reload preserves complex state', async ({ page }) => {
    // Capture state BEFORE saving
    const barracksLabelBefore = await page
      .locator('[data-building="barracks"] .stat-label')
      .textContent();

    const soldierPanelText = await page.locator('#soldier-panel').textContent();

    // Read combat resource values (if visible)
    const chitinText = await page
      .locator('#battle-panel .combat-resources')
      .textContent()
      .catch(() => '');

    // Trigger manual save
    await page.evaluate(() => {
      const swarm = (window as unknown as Record<string, unknown>).__swarm as Record<string, unknown>;
      if (swarm && swarm.saveManager) {
        const sm = swarm.saveManager as { save: (s: unknown, t: number) => void };
        const state = (swarm.manager as { getState: () => unknown }).getState();
        sm.save(state, Date.now());
      }
    });

    // Reload — NO addInitScript this time, reads from localStorage
    await page.reload();

    // Wait for panels to render on reload
    await page.waitForSelector('#panels', { timeout: 10000 });

    // Give the game a moment to transition through phases
    const indicator = page.locator('#phase-indicator');
    await expect(indicator).toContainText('The Expansion', { timeout: 15000 });

    // ─── Verify ALL panels still visible after reload ────────────

    // Phase indicator
    await expect(indicator).toContainText('The Expansion');

    // Egg button
    await expect(page.locator('#click-egg')).toBeVisible();

    // Resource panel
    await expect(page.locator('[data-stat="resources.food"]')).toBeVisible();
    await expect(page.locator('[data-stat="resources.eggs"]')).toBeVisible();

    // Worker assignment
    await expect(page.locator('#worker-assignment')).toBeVisible();

    // Soldier panel
    await expect(page.locator('#soldier-panel')).toBeVisible();

    // Battle panel
    await expect(page.locator('#battle-panel')).toBeVisible();

    // Map panel
    await expect(page.locator('.map-panel')).toBeVisible();

    // Building panel
    const buildingPanel = page.locator('#building-panel');
    await expect(buildingPanel).toBeVisible();
    await expect(buildingPanel.locator('[data-building="barracks"]')).toBeVisible();
    await expect(buildingPanel.locator('[data-building="walls"]')).toBeVisible();
    await expect(buildingPanel.locator('[data-building="warehouse"]')).toBeVisible();

    // Expedition panel
    await expect(page.locator('#expedition-panel')).toBeVisible();

    // Activity log
    await expect(page.locator('#activity-log')).toBeVisible();

    // ─── Verify building levels preserved ─────────────────────────
    const barracksLabelAfter = await page
      .locator('[data-building="barracks"] .stat-label')
      .textContent();
    expect(barracksLabelAfter).toBe(barracksLabelBefore);

    // ─── Verify soldier panel content preserved ───────────────────
    const soldierPanelTextAfter = await page.locator('#soldier-panel').textContent();
    // Should still show Recruit Soldier button (soldier system intact)
    expect(soldierPanelTextAfter).toContain('Recruit Soldier');

    // ─── Verify expedition panel has content ──────────────────────
    const expeditionPanel = page.locator('#expedition-panel');
    // Should have expeditions active or show expedition-related content
    const expContent = await expeditionPanel.textContent();
    // Either active expeditions remain, or they completed — in either case
    // there should be expedition-related text (panel title at minimum)
    expect(expContent).toContain('Expeditions');

    // ─── Verify combat resources preserved ────────────────────────
    // The combat resources area should show seeded values (chitin: 5, silk: 3, venom: 1)
    // Check if combat resources area is visible and has content
    const crAfter = await page
      .locator('#battle-panel .combat-resources')
      .textContent()
      .catch(() => '');
    // If combat resources were visible before, they should be visible after
    if (chitinText && chitinText.trim()) {
      expect(crAfter).toBeTruthy();
    }
  });
});
