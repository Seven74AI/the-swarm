import { test } from '@playwright/test';

const SAVE = {
  version: 8,
  timestamp: Date.now(),
  playTimeMs: 300_000,
  gameState: {
    phase: 'transcendence',
    resources: {
      eggs: 500, larvae: 200, workers: 200, food: 2000,
      nestCapacity: 500, wood: 500, stone: 500, nectar: 300,
      voidCrystals: 200, antimatter: 100, darkMatter: 50,
    },
    eggPipeline: { count: 0, progress: 0 },
    larvaPipeline: { count: 0, progress: 0 },
    workersAssigned: { gather: 20, tend: 10, dig: 5, guard: 5 },
    soldiers: { scouts: 50, warriors: 30, totalKilled: 10 },
    buildings: {
      barracks: { level: 3, count: 1 },
      walls: { level: 3 },
      warehouse: { level: 3 },
    },
    territory: { ownedTiles: 20, bonuses: {} },
    expeditions: [],
    upgrades: {},
    stats: { totalEggsLaid: 10000, totalClicks: 5000, playTimeMs: 300_000 },
    unlockedPanels: [],
    lastSaveTimestamp: 0,
    combatSoldiers: 20,
    soldierStats: { strength: 5, defense: 5, speed: 8, maxHp: 20 },
    soldierPipeline: { count: 0, progress: 0 },
    equipment: { weapon: 5, armor: 5 },
    lastBattle: null,
    combatResources: { chitin: 20, silk: 15, venom: 10 },
    battlesWon: 10,
    battlesLost: 2,
    spaceship: { level: 3, fuel: 80, maxFuel: 200 },
    spaceProbes: [],
    spaceExplorations: [],
    discoveredPlanets: [],
    discoveries: [],
    spaceships: [],
    mapTiles: [],
    victoryAchieved: false,
    autoProduction: {
      enabled: false,
      researches: {},
      buildings: { nursery: 0, hatchery: 0, queens_chamber: 0 },
      progress: 0,
    },
  },
};

test('debug - load transcendence save and capture console', async ({ page }) => {
  const consoleLogs: string[] = [];
  page.on('console', (msg) => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    consoleLogs.push(`[PAGE ERROR] ${err.message}`);
  });

  await page.addInitScript((saveStr) => {
    localStorage.setItem('the_swarm_save', saveStr);
  }, JSON.stringify(SAVE));

  await page.goto('/');
  await page.waitForTimeout(3000);

  // Check if #panels exists
  const hasPanels = await page.locator('#panels').count();
  const appHtml = await page.locator('#app').innerHTML();

  console.log('=== CONSOLE LOGS ===');
  for (const log of consoleLogs) {
    console.log(log);
  }
  console.log('=== HAS PANELS:', hasPanels);
  console.log('=== APP HTML (first 2000 chars) ===');
  console.log(appHtml.substring(0, 2000));
});
