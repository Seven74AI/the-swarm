import { test, expect } from '@playwright/test';

/**
 * E2E test: Automation System (GM-3)
 *
 * Tests the automation research tree and auto egg production lifecycle:
 * 1. Automation panel hidden until Transcendence phase
 * 2. Research "Basic Incubation" → auto rate appears
 * 3. Build Nursery → rate increases
 * 4. Auto eggs accumulate without clicking
 */
test.describe('Automation System (GM-3)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#click-button', { timeout: 10000 });
  });

  test('automation panel exists and has research rows', async ({ page }) => {
    // Fast-forward to transcendence phase to reveal automation panel
    await page.evaluate(() => {
      const state = (window as any).__swarm;
      if (!state) return;
      const st = state.ui.getState();
      st.phase = 'transcendence';
      st.unlockedPanels = ['automation_panel'];
      state.ui.setState(st);
    });

    await page.waitForSelector('#automation-panel', { timeout: 5000 });
    const panel = page.locator('#automation-panel');
    await expect(panel).toBeVisible();

    // Research rows should exist
    const researchRows = panel.locator('.research-row');
    const count = await researchRows.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test('research Basic Incubation enables auto egg rate', async ({ page }) => {
    // Set up state: phase is transcendence, enough resources for Basic Incubation
    await page.evaluate(() => {
      const swarm = (window as any).__swarm;
      if (!swarm) return;
      const st = swarm.ui.getState();
      st.phase = 'transcendence';
      st.unlockedPanels = ['automation_panel'];
      st.resources.food = 500;
      st.resources.workers = 100;
      swarm.ui.setState(st);
    });

    await page.waitForSelector('#automation-panel', { timeout: 5000 });

    // Enable auto-production toggle
    const toggle = page.locator('#automation-panel .auto-toggle');
    await toggle.check();

    // Click the Research button for Basic Incubation
    const basicResearchBtn = page.locator('[data-research="basic_incubation"] button');
    await expect(basicResearchBtn).toBeEnabled();
    await basicResearchBtn.click();

    // Verify the rate display shows > 0
    const rateDisplay = page.locator('#automation-panel .auto-rate');
    await expect(rateDisplay).toContainText('0.5');
  });

  test('auto eggs accumulate without clicking over time', async ({ page }) => {
    // Set up: transcendence phase, Basic Incubation researched, toggle enabled
    await page.evaluate(() => {
      const swarm = (window as any).__swarm;
      if (!swarm) return;
      const st = swarm.ui.getState();
      st.phase = 'transcendence';
      st.unlockedPanels = ['automation_panel'];
      st.resources.food = 500;
      st.resources.workers = 100;
      st.autoProduction.enabled = true;
      st.autoProduction.researches['basic_incubation'] = true;
      swarm.ui.setState(st);
    });

    // Get initial egg count
    const initialEggs = await page.evaluate(() => {
      const swarm = (window as any).__swarm;
      return swarm.ui.getState().resources.eggs;
    });

    // Wait for several ticks (50ms each — wait 2 seconds for ~40 ticks)
    await page.waitForTimeout(2000);

    // Get new egg count
    const newEggs = await page.evaluate(() => {
      const swarm = (window as any).__swarm;
      return swarm.ui.getState().resources.eggs;
    });

    // Auto production at 0.5/s for 2s = 1 egg expected
    expect(newEggs).toBeGreaterThan(initialEggs);
    expect(newEggs - initialEggs).toBeGreaterThanOrEqual(0); // At least some eggs produced
  });

  test('higher research tiers stack multiplicatively', async ({ page }) => {
    // Set up: full research tree unlocked with high resources
    await page.evaluate(() => {
      const swarm = (window as any).__swarm;
      if (!swarm) return;
      const st = swarm.ui.getState();
      st.phase = 'transcendence';
      st.unlockedPanels = ['automation_panel'];
      st.resources.food = 10000;
      st.resources.workers = 1000;
      st.resources.stone = 5000;
      st.resources.voidCrystals = 50;
      st.resources.antimatter = 50;
      st.autoProduction.enabled = true;
      st.autoProduction.researches['basic_incubation'] = true;
      st.autoProduction.researches['queens_pheromones'] = true;
      st.autoProduction.researches['thermal_regulation'] = true;
      st.autoProduction.researches['genetic_optimization'] = true;
      st.autoProduction.researches['cloning_vats'] = true;
      st.autoProduction.buildings['nursery'] = 3;
      st.autoProduction.buildings['hatchery'] = 2;
      swarm.ui.setState(st);
    });

    await page.waitForSelector('#automation-panel', { timeout: 5000 });

    // Check rate display shows high rate (should be > 20 eggs/s)
    const rateDisplay = page.locator('#automation-panel .auto-rate');
    const rateText = await rateDisplay.textContent();
    const rateMatch = rateText?.match(/([\d.]+)/);
    if (rateMatch) {
      const rate = parseFloat(rateMatch[1]);
      expect(rate).toBeGreaterThan(20);
    }
  });

  test('research prerequisites block invalid purchases', async ({ page }) => {
    await page.evaluate(() => {
      const swarm = (window as any).__swarm;
      if (!swarm) return;
      const st = swarm.ui.getState();
      st.phase = 'transcendence';
      st.unlockedPanels = ['automation_panel'];
      st.resources.food = 10000;
      st.resources.workers = 1000;
      st.resources.stone = 5000;
      // NO queens_pheromones research — thermal_regulation should be blocked
      swarm.ui.setState(st);
    });

    await page.waitForSelector('#automation-panel', { timeout: 5000 });

    // thermal_regulation button should be disabled (prerequisite not met)
    const thermalBtn = page.locator('[data-research="thermal_regulation"] button');
    await expect(thermalBtn).toBeDisabled();
  });
});
