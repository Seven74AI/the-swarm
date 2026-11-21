import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { createEmptyMap, createInitialState, TileType, type GameState, type ResearchProjectId } from '../../../src/state/GameState';
import { processTick } from '../../../src/engine/processTick';
import { catchUp, type CatchUpDeps } from '../../../src/engine/catchUp';
import { EventBus } from '../../../src/engine/EventBus';
import { EventQueue } from '../../../src/engine/events';
import { ResourceSystem } from '../../../src/systems/ResourceSystem';
import { SoldierSystem } from '../../../src/systems/SoldierSystem';
import { MapSystem } from '../../../src/systems/MapSystem';
import { TerritorySystem } from '../../../src/systems/TerritorySystem';
import { PhaseStateMachine } from '../../../src/phases/PhaseStateMachine';
import { TRANSITIONS } from '../../../src/phases/transitions';
import { Phase } from '../../../src/phases/phases';
import { DECISIONS } from '../../../src/data/content/decisions';
import { mutationBalance } from '../../../src/data/balance/mutations';
import { createActions, type Actions } from '../../../src/actions';
import { BattleSystem } from '../../../src/systems/BattleSystem';
import { TICK_MS } from '../../../src/data/constants';
import { NEST_UPGRADE_IDS, upgradeBalance, type UpgradeId } from '../../../src/data/balance/upgrades';

/**
 * Story 3.3 (FR34, AR20): every count is a whole number.
 *
 * A property test: random seeded states run through a random mix of live
 * ticks (any step length up to a catch-up macro-step), player actions and
 * offline catch-ups. After EVERY step each value in `state.resources` (and the
 * other counted stocks: combat loot, soldiers) is an integer ≥ 0, and entropy
 * (a meter, not a resource) stays in 0–100 and no action but prestige lowers it.
 *
 * Deterministic: fast-check runs from a fixed seed, and every draw the
 * simulation makes comes from the state's own generator (`state.rng`,
 * Story 3.1), which each random state sets from that seed.
 */

const SEED = 3_3;
const RUNS = 100;
const MAX_COMMANDS = 25;

beforeEach(() => {
  // Each catch-up logs one summary line; keep the run quiet.
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'debug').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Random states ─────────────────────────────────────────────────────────

const PHASES = [Phase.EGG_LAYING, Phase.COLONY, Phase.COMBAT, Phase.EXPANSION, Phase.SPACE, Phase.TRANSCENDENCE];
const PRESTIGE_IDS = [
  'egg_laying_bonus', 'hatching_bonus', 'food_bonus', 'soldier_training_bonus', 'worker_efficiency_bonus',
  'auto_egg_laying', 'starting_resources', 'temporal_resonance',
];
const PROJECT_IDS: ResearchProjectId[] = ['voidCrystalSynthesis', 'antimatterContainment', 'darkMatterDetection', 'dormantForaging'];
const MUTATION_IDS = Object.keys(mutationBalance);
const amount = (max: number) => fc.integer({ min: 0, max });

const arbState: fc.Arbitrary<GameState> = fc
  .record({
    phase: fc.constantFrom(...PHASES),
    workers: amount(400),
    headroom: fc.integer({ min: -50, max: 300 }),
    shares: fc.array(amount(100), { minLength: 6, maxLength: 6 }),
    eggs: amount(600),
    larvae: amount(600),
    progress: fc.double({ min: 0, max: 0.999, noNaN: true }),
    food: amount(20_000),
    wood: amount(2_000),
    stone: amount(2_000),
    nectar: amount(1_000),
    voidCrystals: amount(80),
    antimatter: amount(20),
    darkMatter: amount(200),
    surveyData: amount(60),
    remainder: fc.double({ min: 0, max: 0.999, noNaN: true }),
    combat: fc.array(amount(60), { minLength: 3, maxLength: 3 }),
    training: amount(100),
    combatSoldiers: amount(80),
    scouts: amount(20),
    warriors: amount(20),
    buildingLevels: fc.array(amount(6), { minLength: 6, maxLength: 6 }),
    equipment: fc.array(amount(5), { minLength: 2, maxLength: 2 }),
    clickPower: amount(20),
    // Egg-chamber levels (Story 4.6), up to each one's last level.
    nestUpgrades: fc.record(Object.fromEntries(NEST_UPGRADE_IDS.map((id) => [id, fc.integer({ min: 0, max: upgradeBalance[id].maxLevel ?? 0 })])) as Record<(typeof NEST_UPGRADE_IDS)[number], fc.Arbitrary<number>>),
    prestige: fc.subarray(PRESTIGE_IDS),
    legacyPoints: amount(200),
    projects: fc.array(fc.constantFrom('idle', 'running', 'done'), { minLength: 4, maxLength: 4 }),
    particleLab: amount(7),
    autoEggs: fc.boolean(),
    nursery: amount(4),
    tiles: fc.array(amount(2), { minLength: 3, maxLength: 3 }),
    decision: fc.option(fc.constantFrom(...DECISIONS.map((d) => d.id)), { nil: null }),
    entropy: fc.double({ min: 0, max: 100, noNaN: true }),
    dampener: amount(3),
    mutations: fc.subarray(MUTATION_IDS),
    ship: fc.option(amount(400), { nil: null }),
    colonyShip: amount(3),
    prestigeReady: fc.boolean(),
    rng: fc.integer({ min: 0, max: 2 ** 32 - 1 }),
  })
  .map((r) => {
    const s = createInitialState();
    s.phase = r.phase;
    s.rng = r.rng;
    s.resources = {
      ...s.resources,
      workers: r.workers,
      nestCapacity: Math.max(0, r.workers + r.headroom),
      eggs: r.eggs,
      larvae: r.larvae,
      food: r.food,
      wood: r.wood,
      stone: r.stone,
      nectar: r.nectar,
      voidCrystals: r.voidCrystals,
      antimatter: r.antimatter,
      darkMatter: r.darkMatter,
      surveyData: r.surveyData,
    };
    s.eggPipeline = { count: r.eggs, progress: r.progress };
    s.larvaPipeline = { count: r.larvae, progress: r.progress };
    s.resourceRemainder = { food: r.remainder, wood: r.remainder, stone: r.remainder, nectar: r.remainder };
    // Assignments never exceed the workers on hand.
    const total = r.shares.reduce((a, b) => a + b, 0) || 1;
    const part = (i: number) => Math.floor((r.workers * r.shares[i]) / total / 1.25);
    s.workersAssigned = { gather: part(0), tend: part(1), dig: part(2), guard: part(3), researchers: part(4), forage: part(5) };
    s.combatResources = { chitin: r.combat[0], silk: r.combat[1], venom: r.combat[2] };
    s.soldierPipeline = { count: r.training, progress: 0 };
    s.combatSoldiers = r.combatSoldiers;
    s.soldiers = { ...s.soldiers, scouts: r.scouts, warriors: r.warriors };
    const [barracks, walls, warehouse, silk, chitin, venom] = r.buildingLevels;
    s.buildings = {
      barracks: { level: barracks, count: barracks },
      walls: { level: walls },
      warehouse: { level: warehouse },
      silk_weaving: { level: silk },
      chitin_armory: { level: chitin },
      venom_lab: { level: venom },
    };
    s.equipment = { weapon: r.equipment[0], armor: r.equipment[1] };
    s.upgrades = { ...s.upgrades, click_power: r.clickPower, ...r.nestUpgrades };
    s.prestigeTree.purchased = [...r.prestige];
    s.prestige = { ...s.prestige, legacyPoints: r.legacyPoints };
    PROJECT_IDS.forEach((id, i) => {
      const status = r.projects[i];
      s.research.projects[id] =
        status === 'running' ? { status: 'running', progressMs: 0, durationMs: 1_000 } : { status } as { status: 'idle' | 'done' };
    });
    s.conversions = { ...s.conversions, particleLab: r.particleLab };
    if (r.autoEggs) {
      s.autoProduction.enabled = true;
      s.autoProduction.researches = { basic_incubation: true };
      s.autoProduction.buildings.nursery = r.nursery;
    }
    // A discovered map is never regenerated; claim a few resource tiles.
    const tiles = createEmptyMap();
    tiles[0] = { ...tiles[0], discovered: true };
    let i = 1;
    const claim = (type: TileType, count: number) => {
      for (let c = 0; c < count; c++, i++) tiles[i] = { ...tiles[i], type, discovered: true, claimed: true };
    };
    claim(TileType.FOREST, r.tiles[0]);
    claim(TileType.MOUNTAIN, r.tiles[1]);
    claim(TileType.MEADOW, r.tiles[2]);
    s.mapTiles = tiles;
    if (r.decision !== null) s.decision = { ...s.decision, open: { id: r.decision, remainingMs: null, openedAtSessionMs: 0, roll: r.progress } };
    s.entropy = r.entropy;
    s.entropyDampener = { level: r.dampener };
    s.mutations = s.mutations.map((m) => ({ ...m, purchased: r.mutations.includes(m.id) }));
    if (r.ship !== null) {
      s.spaceships = [{
        id: 'ship-1', type: 'scout_ship', level: 1, fuel: 0, maxFuel: 100, status: 'exploring',
        destinationName: 'Kepler', missionTicksRemaining: r.ship,
      }];
    }
    s.spaceship = { ...s.spaceship, level: r.colonyShip };
    if (r.prestigeReady) {
      // Far enough along to prestige: big lifetime totals and the core buildings up.
      for (const b of ['barracks', 'walls', 'warehouse'] as const) s.buildings[b].level = Math.max(5, s.buildings[b].level);
      s.prestige = {
        ...s.prestige,
        totalFoodProduced: 10 * r.food + 1e6, totalWoodProduced: 1e6, totalStoneProduced: 1e6, totalNectarProduced: 1e6,
      };
    }
    return s;
  });

// ─── Commands: live ticks, actions, catch-ups ──────────────────────────────

type Command =
  | { kind: 'tick'; ticks: number }
  | { kind: 'catchUp'; ms: number }
  | { kind: 'action'; run: (a: Actions, s: GameState) => unknown; name: string };

const act = (name: string, run: (a: Actions, s: GameState) => unknown): fc.Arbitrary<Command> =>
  fc.constant({ kind: 'action', name, run });

const arbAction: fc.Arbitrary<Command> = fc.oneof(
  act('layEgg', (a) => a.layEgg()),
  fc.constantFrom('gather', 'forage', 'tend', 'dig', 'guard', 'research' as const).chain((role) =>
    fc.integer({ min: -50, max: 50 }).map((delta): Command => ({ kind: 'action', name: `stepRole ${role} ${delta}`, run: (a) => a.stepRole(role, delta) })),
  ),
  // Click Power and the egg-chamber upgrades (Story 4.6).
  fc.constantFrom(...(Object.keys(upgradeBalance) as UpgradeId[])).map(
    (id): Command => ({ kind: 'action', name: `buyUpgrade ${id}`, run: (a) => a.buyUpgrade(id) }),
  ),
  fc.constantFrom('barracks', 'walls', 'warehouse', 'silk_weaving', 'chitin_armory', 'venom_lab' as const).map(
    (b): Command => ({ kind: 'action', name: `buyBuilding ${b}`, run: (a) => a.buyBuilding(b) }),
  ),
  fc.constantFrom('basic_incubation', 'queens_pheromones', 'thermal_regulation', 'genetic_optimization', 'cloning_vats' as const).map(
    (r): Command => ({ kind: 'action', name: `researchAutomation ${r}`, run: (a) => a.researchAutomation(r) }),
  ),
  fc.constantFrom('nursery', 'hatchery', 'queens_chamber' as const).map(
    (b): Command => ({ kind: 'action', name: `buildAutomation ${b}`, run: (a) => a.buildAutomation(b) }),
  ),
  act('assignResearcher', (a) => a.assignResearcher()),
  act('unassignResearcher', (a) => a.unassignResearcher()),
  fc.constantFrom(...PROJECT_IDS).map((id): Command => ({ kind: 'action', name: `startResearch ${id}`, run: (a) => a.startResearch(id) })),
  fc.constantFrom(...PROJECT_IDS).map((id): Command => ({ kind: 'action', name: `cancelResearch ${id}`, run: (a) => a.cancelResearch(id) })),
  act('runConversions', (a) => a.runConversions()),
  act('buildParticleLab', (a) => a.buildParticleLab()),
  act('trainSoldier', (a) => a.trainSoldier()),
  act('upgradeWeapon', (a) => a.upgradeWeapon()),
  act('upgradeArmor', (a) => a.upgradeArmor()),
  act('fight', (a) => a.fight()),
  fc.constantFrom(...MUTATION_IDS).map((id): Command => ({ kind: 'action', name: `buyMutation ${id}`, run: (a) => a.buyMutation(id) })),
  act('recruitScout', (a) => a.recruitScout()),
  act('recruitWarrior', (a) => a.recruitWarrior()),
  fc.tuple(amount(5), amount(5), fc.constantFrom('FOREST', 'MOUNTAIN', 'MEADOW', 'ENEMY NEST')).map(
    ([sc, wa, dest]): Command => ({ kind: 'action', name: `startExpedition ${sc} ${wa} ${dest}`, run: (a) => a.startExpedition(sc, wa, dest) }),
  ),
  act('buildShip', (a) => a.buildShip()),
  act('upgradeShip', (a) => a.upgradeShip()),
  fc.constantFrom('Kepler', 'Proxima', 'Andromeda').map((d): Command => ({ kind: 'action', name: `launchProbe ${d}`, run: (a) => a.launchProbe(d) })),
  act('prestige', (a) => a.prestige()),
  fc.constantFrom(...PRESTIGE_IDS).map(
    (id): Command => ({ kind: 'action', name: `buyPrestigeUpgrade ${id}`, run: (a) => a.buyPrestigeUpgrade(id as never) }),
  ),
  act('continuePhase', (a) => a.continuePhase()),
  act('chooseDecision', (a, s) => {
    const open = s.decision.open;
    const def = open ? DECISIONS.find((d) => d.id === open.id) : undefined;
    return def ? a.chooseDecision(def.choices[0].id) : undefined;
  }),
  act('chooseDecision (second)', (a, s) => {
    const open = s.decision.open;
    const def = open ? DECISIONS.find((d) => d.id === open.id) : undefined;
    return def ? a.chooseDecision(def.choices[def.choices.length - 1].id) : undefined;
  }),
);

const arbCommand: fc.Arbitrary<Command> = fc.oneof(
  // A live step: one tick up to a 10 s macro-step.
  fc.integer({ min: 1, max: 200 }).map((ticks): Command => ({ kind: 'tick', ticks })),
  // An absence: up to two hours.
  fc.integer({ min: 0, max: 2 * 60 * 60 * 1000 }).map((ms): Command => ({ kind: 'catchUp', ms })),
  arbAction,
  arbAction,
);

function harness(initial: GameState) {
  const bus = new EventBus();
  let state = initial;
  const resourceSystem = new ResourceSystem(bus);
  const soldierSystem = new SoldierSystem(bus);
  const mapSystem = new MapSystem();
  const territorySystem = new TerritorySystem();
  const actions = createActions({
    bus, resourceSystem, soldierSystem, battleSystem: new BattleSystem(bus), territorySystem,
    store: { get: () => state, set: (s) => { state = s; } },
  });
  const fsm = new PhaseStateMachine(TRANSITIONS);
  const deps: CatchUpDeps = { resourceSystem, soldierSystem, mapSystem, territorySystem, latch: (s) => fsm.latch(s) };
  return {
    get: () => state,
    run(cmd: Command): void {
      if (cmd.kind === 'tick') {
        state = fsm.latch(processTick(state, resourceSystem, soldierSystem, mapSystem, territorySystem, new EventQueue(), (cmd.ticks * TICK_MS) / 1000));
      } else if (cmd.kind === 'catchUp') {
        state = catchUp(state, cmd.ms, Math.floor(cmd.ms / TICK_MS), deps);
      } else {
        const before = state.entropy;
        cmd.run(actions, state);
        // Entropy is a meter, never spent: only prestige resets it.
        if (cmd.name !== 'prestige') expect(state.entropy, `${cmd.name} spends no entropy`).toBeGreaterThanOrEqual(before);
      }
    },
  };
}

function describeCmd(cmd: Command): string {
  return cmd.kind === 'action' ? cmd.name : cmd.kind === 'tick' ? `tick ×${cmd.ticks}` : `catchUp ${cmd.ms} ms`;
}

function expectWhole(s: GameState, where: string): void {
  for (const [key, value] of Object.entries(s.resources)) {
    expect(Number.isInteger(value), `${where}: resources.${key} = ${value} is an integer`).toBe(true);
    expect(value, `${where}: resources.${key} ≥ 0`).toBeGreaterThanOrEqual(0);
  }
  // The other stocks the colony counts and spends: combat loot and soldiers.
  const counts = { ...s.combatResources, combatSoldiers: s.combatSoldiers, scouts: s.soldiers.scouts, warriors: s.soldiers.warriors };
  for (const [key, value] of Object.entries(counts)) {
    expect(Number.isInteger(value) && value >= 0, `${where}: ${key} = ${value} is a whole number`).toBe(true);
  }
  expect(s.entropy, `${where}: entropy is a 0–100 meter`).toBeGreaterThanOrEqual(0);
  expect(s.entropy, `${where}: entropy is a 0–100 meter`).toBeLessThanOrEqual(100);
}

describe('every resource is a whole number (Story 3.3)', () => {
  it('stays an integer ≥ 0 through random ticks, actions and catch-ups', () => {
    fc.assert(
      fc.property(arbState, fc.array(arbCommand, { minLength: 1, maxLength: MAX_COMMANDS }), (initial, commands) => {
        const h = harness(initial);
        expectWhole(h.get(), 'seed state');
        commands.forEach((cmd, i) => {
          h.run(cmd);
          expectWhole(h.get(), `after #${i} ${describeCmd(cmd)}`);
        });
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
});
