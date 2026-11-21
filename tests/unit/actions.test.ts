// @vitest-environment node
/**
 * Story 1.6: every player intent is an action in `src/actions/`.
 *
 * A valid intent writes the new state once, between ticks, and returns
 * `{ ok: true }`. An invalid one returns `{ ok: false, reason }` with a typed
 * reason and leaves the `gameState` reference untouched (AR16, AR22).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { gameState } from '../../src/state/gameSignal';
import { createInitialState, type GameState } from '../../src/state/GameState';
import { EventBus } from '../../src/engine/EventBus';
import { createActions, type Actions } from '../../src/actions';
import { REFUSAL_REASONS, type ActionResult, type RefusalReason } from '../../src/actions/result';
import { ResourceSystem } from '../../src/systems/ResourceSystem';
import { SoldierSystem } from '../../src/systems/SoldierSystem';
import { soldierBalance } from '../../src/data/balance/soldiers';
import { BattleSystem } from '../../src/systems/BattleSystem';
import { TerritorySystem } from '../../src/systems/TerritorySystem';
import { MAX_ACTIVE_EXPEDITIONS } from '../../src/systems/ExpeditionSystem';
import { MAX_PROBES } from '../../src/systems/ExplorationSystem';
import { MAX_SHIP_LEVEL } from '../../src/systems/SpaceshipSystem';
import { getMaxScouts } from '../../src/systems/RecruitmentSystem';
import { MUTATIONS } from '../../src/systems/MutationSystem';
import { RESEARCHES, AUTOMATION_BUILDINGS } from '../../src/systems/AutomationSystem';
import { getProjects } from '../../src/systems/ResearchSystem';
import { PRESTIGE_UPGRADES } from '../../src/data/prestigeTree';
import { TileType } from '../../src/state/GameState';
import { applyChoice } from '../../src/systems/DecisionSystem';
import { getDecision } from '../../src/data/content/decisions';

const LOTS = 1_000_000_000;

/** A state that can afford anything. */
function rich(over: Partial<GameState> = {}): GameState {
  const s = createInitialState();
  return {
    ...s,
    resources: Object.fromEntries(Object.keys(s.resources).map((k) => [k, LOTS])) as GameState['resources'],
    combatResources: { chitin: LOTS, silk: LOTS, venom: LOTS },
    prestige: { ...s.prestige, legacyPoints: LOTS },
    ...over,
  };
}

/** A state with nothing to spend. */
function poor(over: Partial<GameState> = {}): GameState {
  return { ...createInitialState(), ...over };
}

let bus: EventBus;
let actions: Actions;

beforeEach(() => {
  bus = new EventBus();
  actions = createActions({
    bus,
    resourceSystem: new ResourceSystem(bus),
    soldierSystem: new SoldierSystem(bus),
    battleSystem: new BattleSystem(bus),
    territorySystem: new TerritorySystem(),
  });
});

function given(s: GameState): GameState {
  gameState.value = s;
  return s;
}

function expectRefused(result: ActionResult, reason: RefusalReason, before: GameState): void {
  expect(result).toEqual({ ok: false, reason });
  expect(gameState.value).toBe(before);
}

function expectApplied(result: ActionResult, before: GameState): GameState {
  expect(result.ok).toBe(true);
  expect(gameState.value).not.toBe(before);
  return gameState.value;
}

describe('actions write once, between ticks', () => {
  it('a valid action writes the state signal exactly once', () => {
    given(rich({ phase: 'colony' }));
    const writes = vi.spyOn(gameState, 'value', 'set');
    writes.mockClear();
    try {
      actions.buyBuilding('barracks');
      expect(writes).toHaveBeenCalledTimes(1);
    } finally {
      writes.mockRestore();
    }
  });

  it('a refused action never writes the state signal', () => {
    given(poor());
    const writes = vi.spyOn(gameState, 'value', 'set');
    writes.mockClear();
    try {
      actions.buyBuilding('barracks');
      expect(writes).not.toHaveBeenCalled();
    } finally {
      writes.mockRestore();
    }
  });

  it('events an action raises are delivered after its write', () => {
    const before = given(rich({ phase: 'colony' }));
    let seen: GameState | null = null;
    bus.subscribe('building_complete', () => {
      seen = gameState.value;
    });
    actions.buyBuilding('walls');
    expect(seen).not.toBeNull();
    expect(seen).not.toBe(before);
    expect(seen!.buildings.walls.level).toBeGreaterThan(before.buildings.walls.level);
  });

  it('every refusal reason is one of the typed reasons', () => {
    given(poor());
    const results: ActionResult[] = [
      actions.assignWorker('gather'),
      actions.unassignWorker('gather'),
      actions.buyBuilding('barracks'),
      actions.trainSoldier(),
      actions.fight(),
      actions.recruitScout(),
      actions.startExpedition(1, 0, 'Meadow'),
      actions.prestige(),
    ];
    for (const r of results) {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(REFUSAL_REASONS).toContain(r.reason);
    }
  });
});

describe('nest', () => {
  it('lays an egg', () => {
    const before = given(poor());
    const after = expectApplied(actions.layEgg(), before);
    expect(after.resources.eggs).toBeGreaterThan(before.resources.eggs);
  });

  it('assigns a free worker, refuses when none is free', () => {
    let before = given(poor());
    expectRefused(actions.assignWorker('gather'), 'no_free_workers', before);

    before = given(poor({ resources: { ...createInitialState().resources, workers: 3 } }));
    const after = expectApplied(actions.assignWorker('gather'), before);
    expect(after.workersAssigned.gather).toBeGreaterThan(before.workersAssigned.gather);
  });

  it('unassigns a worker, refuses when the role is empty', () => {
    let before = given(poor());
    expectRefused(actions.unassignWorker('dig'), 'none_assigned', before);

    const base = createInitialState();
    before = given(poor({
      resources: { ...base.resources, workers: 2 },
      workersAssigned: { ...base.workersAssigned, dig: 1 },
    }));
    const after = expectApplied(actions.unassignWorker('dig'), before);
    expect(after.workersAssigned.dig).toBeLessThan(before.workersAssigned.dig);
  });

  it('buys an upgrade, refuses when unaffordable or unknown', () => {
    let before = given(poor());
    expectRefused(actions.buyUpgrade('click_power'), 'cannot_afford', before);
    expectRefused(actions.buyUpgrade('no_such_upgrade'), 'unknown_id', before);

    before = given(rich());
    const after = expectApplied(actions.buyUpgrade('click_power'), before);
    expect(after.upgrades.click_power ?? 0).toBeGreaterThan(before.upgrades.click_power ?? 0);
  });
});

describe('buildings and automation', () => {
  it('buys a building, refuses when unaffordable or before its phase (Story 3.5)', () => {
    let before = given(rich());
    expectRefused(actions.buyBuilding('warehouse'), 'locked', before);

    before = given(poor({ phase: 'colony' }));
    expectRefused(actions.buyBuilding('warehouse'), 'cannot_afford', before);

    before = given(rich({ phase: 'colony' }));
    const after = expectApplied(actions.buyBuilding('warehouse'), before);
    expect(after.buildings.warehouse.level).toBeGreaterThan(before.buildings.warehouse.level);
    expect(after.resources.wood).toBeLessThan(before.resources.wood);
  });

  it('researches automation, refuses when locked, owned or unaffordable', () => {
    const [first, second] = Object.keys(RESEARCHES) as (keyof typeof RESEARCHES)[];
    let before = given(poor());
    expectRefused(actions.researchAutomation(first), 'cannot_afford', before);
    expectRefused(actions.researchAutomation(second), 'locked', before);

    before = given(rich());
    const after = expectApplied(actions.researchAutomation(first), before);
    expect(after.autoProduction.researches[first]).toBe(true);
    expectRefused(actions.researchAutomation(first), 'already_owned', after);
  });

  it('builds an automation building up to its max level', () => {
    const id = (Object.keys(AUTOMATION_BUILDINGS) as (keyof typeof AUTOMATION_BUILDINGS)[])[0];
    let before = given(poor());
    expectRefused(actions.buildAutomation(id), 'cannot_afford', before);

    before = given(rich());
    const after = expectApplied(actions.buildAutomation(id), before);
    expect(after.autoProduction.buildings[id] ?? 0).toBeGreaterThan(before.autoProduction.buildings[id] ?? 0);

    const maxed = given(rich({
      autoProduction: {
        ...before.autoProduction,
        buildings: { ...before.autoProduction.buildings, [id]: AUTOMATION_BUILDINGS[id].maxLevel },
      },
    }));
    expectRefused(actions.buildAutomation(id), 'max_level', maxed);
  });

  it('switches auto-production on and off', () => {
    const before = given(poor());
    const after = expectApplied(actions.setAutoProduction(!before.autoProduction.enabled), before);
    expect(after.autoProduction.enabled).toBe(!before.autoProduction.enabled);
    expectRefused(actions.setAutoProduction(after.autoProduction.enabled), 'unavailable', after);
  });
});

describe('research', () => {
  const [first, second] = getProjects();
  const staffed = (over: Partial<GameState> = {}): GameState => {
    const s = rich(over);
    return { ...s, workersAssigned: { ...s.workersAssigned, researchers: first.requiredResearchers } };
  };

  it('assigns and unassigns researchers', () => {
    let before = given(poor());
    expectRefused(actions.assignResearcher(), 'no_free_workers', before);
    expectRefused(actions.unassignResearcher(), 'none_assigned', before);

    before = given(rich());
    const after = expectApplied(actions.assignResearcher(), before);
    expect(after.workersAssigned.researchers).toBeGreaterThan(before.workersAssigned.researchers);
    const back = expectApplied(actions.unassignResearcher(), after);
    expect(back.workersAssigned.researchers).toBeLessThan(after.workersAssigned.researchers);
  });

  it('starts a project as a running lifecycle in game-time ms', () => {
    let before = given(rich());
    expectRefused(actions.startResearch(first.id), 'too_few_researchers', before);
    expectRefused(actions.startResearch(second.id), 'locked', before);

    before = given(poor({ workersAssigned: { ...createInitialState().workersAssigned, researchers: first.requiredResearchers } }));
    expectRefused(actions.startResearch(first.id), 'cannot_afford', before);

    before = given(staffed());
    const after = expectApplied(actions.startResearch(first.id), before);
    const project = after.research.projects[first.id];
    expect(project.status).toBe('running');
    if (project.status === 'running') {
      expect(project.progressMs).toBe(0);
      expect(project.durationMs).toBeGreaterThan(0);
    }
    expectRefused(actions.startResearch(first.id), 'already_running', after);
  });

  it('cancels a running project, refuses an idle one', () => {
    let before = given(staffed());
    expectRefused(actions.cancelResearch(first.id), 'not_running', before);

    actions.startResearch(first.id);
    before = gameState.value;
    const after = expectApplied(actions.cancelResearch(first.id), before);
    expect(after.research.projects[first.id].status).toBe('idle');
  });

  it('refuses a finished project', () => {
    const base = staffed();
    const before = given({
      ...base,
      research: { projects: { ...base.research.projects, [first.id]: { status: 'done' } } },
    });
    expectRefused(actions.startResearch(first.id), 'already_owned', before);
  });

  it('runs conversions only once one is unlocked', () => {
    const before = given(rich());
    expectRefused(actions.runConversions(), 'locked', before);

    const unlocked = given({
      ...before,
      workersAssigned: { ...before.workersAssigned, researchers: first.requiredResearchers },
      research: { projects: { ...before.research.projects, voidCrystalSynthesis: { status: 'done' } } },
    });
    const after = expectApplied(actions.runConversions(), unlocked);
    expect(after.resources.voidCrystals).toBeGreaterThan(unlocked.resources.voidCrystals);
  });
});

describe('combat', () => {
  it('trains a soldier, refuses without a worker or food', () => {
    let before = given(poor());
    expectRefused(actions.trainSoldier(), 'no_free_workers', before);

    before = given(poor({ resources: { ...createInitialState().resources, workers: 2 } }));
    expectRefused(actions.trainSoldier(), 'cannot_afford', before);

    before = given(rich());
    const after = expectApplied(actions.trainSoldier(), before);
    expect(after.soldierPipeline.count).toBeGreaterThan(before.soldierPipeline.count);
  });

  it('trains only a free worker: one with a job stays on it (Story 1.25, as assignResearcher in ADR 0016)', () => {
    const base = rich();
    const workers = 4;
    const busy = given({
      ...base,
      resources: { ...base.resources, workers },
      workersAssigned: { ...base.workersAssigned, gather: workers, tend: 0, dig: 0, guard: 0 },
    });
    expectRefused(actions.trainSoldier(), 'no_free_workers', busy);
  });

  it('upgrades weapons and armour behind their buildings', () => {
    const base = rich();
    let before = given(base);
    expectRefused(actions.upgradeWeapon(), 'locked', before);
    expectRefused(actions.upgradeArmor(), 'locked', before);

    const built = { ...base, buildings: { ...base.buildings, chitin_armory: { level: 1 }, silk_weaving: { level: 1 } } };
    before = given({ ...built, combatResources: { chitin: 0, silk: 0, venom: 0 } });
    expectRefused(actions.upgradeWeapon(), 'cannot_afford', before);
    expectRefused(actions.upgradeArmor(), 'cannot_afford', before);

    before = given(built);
    let after = expectApplied(actions.upgradeWeapon(), before);
    expect(after.equipment.weapon).toBeGreaterThan(before.equipment.weapon);
    after = expectApplied(actions.upgradeArmor(), after);
    expect(after.equipment.armor).toBeGreaterThan(before.equipment.armor);

    before = given({ ...built, equipment: { weapon: soldierBalance.maxEquipmentLevel, armor: soldierBalance.maxEquipmentLevel } });
    expectRefused(actions.upgradeWeapon(), 'max_level', before);
    expectRefused(actions.upgradeArmor(), 'max_level', before);
  });

  it('fights and records the battle as a finished lifecycle in game time', () => {
    let before = given(poor());
    expectRefused(actions.fight(), 'no_soldiers', before);

    before = given(rich({ combatSoldiers: 20, stats: { ...createInitialState().stats, playTimeMs: 123_000 } }));
    const result = actions.fight();
    const after = expectApplied(result, before);
    if (result.ok) expect(typeof result.value.victory).toBe('boolean');
    expect(after.lastBattle.status).toBe('done');
    if (after.lastBattle.status === 'done') {
      expect(after.lastBattle.atMs).toBe(before.stats.playTimeMs);
    }
  });

  it('fights the enemy on the card and refuses an unknown one (Story 1.25)', () => {
    const before = given(rich({ combatSoldiers: 20, nextEnemy: 'termite' }));
    expectRefused(actions.fight('no_such_enemy'), 'unknown_id', before);
    const result = actions.fight('termite');
    expectApplied(result, before);
    if (result.ok) expect(result.value.enemyType).toBe('termite');
  });

  it('refuses to fight an enemy that is no longer the next one (Story 4.1)', () => {
    const before = given(rich({ combatSoldiers: 20, nextEnemy: 'spider' }));
    expectRefused(actions.fight('termite'), 'unavailable', before);
    const result = actions.fight();
    expectApplied(result, before);
    if (result.ok) expect(result.value.enemyType).toBe('spider');
  });

  it('buys a mutation once, behind its prerequisite', () => {
    const free = MUTATIONS.find((m) => m.prerequisite === null)!;
    const gated = MUTATIONS.find((m) => m.prerequisite !== null)!;
    let before = given(poor());
    expectRefused(actions.buyMutation(free.id), 'cannot_afford', before);
    expectRefused(actions.buyMutation('no_such_mutation'), 'unknown_id', before);

    before = given(rich());
    expectRefused(actions.buyMutation(gated.id), 'locked', before);
    const after = expectApplied(actions.buyMutation(free.id), before);
    expect(after.mutations.find((m) => m.id === free.id)?.purchased).toBe(true);
    expectRefused(actions.buyMutation(free.id), 'already_owned', after);
  });

  it('recruits scouts and warriors behind the barracks, up to its cap', () => {
    let before = given(rich());
    expectRefused(actions.recruitScout(), 'locked', before);
    expectRefused(actions.recruitWarrior(), 'locked', before);

    const base = rich();
    const barracks = { ...base.buildings, barracks: { level: 2, count: 1 } };
    before = given({ ...base, buildings: barracks });
    let after = expectApplied(actions.recruitScout(), before);
    expect(after.soldiers.scouts).toBeGreaterThan(before.soldiers.scouts);
    after = expectApplied(actions.recruitWarrior(), after);
    expect(after.soldiers.warriors).toBeGreaterThan(before.soldiers.warriors);

    const full = given({ ...base, buildings: barracks, soldiers: { ...base.soldiers, scouts: getMaxScouts({ ...base, buildings: barracks }) } });
    expectRefused(actions.recruitScout(), 'at_capacity', full);

    before = given({ ...poor(), buildings: barracks });
    expectRefused(actions.recruitScout(), 'no_free_workers', before);
  });
});

describe('expansion', () => {
  it('starts an expedition as a running lifecycle, refuses without soldiers or slots', () => {
    let before = given(poor());
    expectRefused(actions.startExpedition(1, 0, 'Meadow'), 'no_soldiers', before);

    const base = rich();
    before = given({ ...base, soldiers: { ...base.soldiers, scouts: 10, warriors: 10 } });
    const after = expectApplied(actions.startExpedition(1, 1, 'Meadow'), before);
    expect(after.expeditions).toHaveLength(before.expeditions.length + 1);
    const exp = after.expeditions[after.expeditions.length - 1];
    expect(exp.status).toBe('running');
    expect(exp.remainingMs).toBeGreaterThan(0);
    expect(after.soldiers.scouts).toBeLessThan(before.soldiers.scouts);

    for (let i = 1; i < MAX_ACTIVE_EXPEDITIONS; i++) actions.startExpedition(1, 0, 'Forest');
    const full = gameState.value;
    expect(full.expeditions).toHaveLength(MAX_ACTIVE_EXPEDITIONS);
    expectRefused(actions.startExpedition(1, 0, 'Forest'), 'slots_full', full);
  });

  it('claims a discovered tile next to owned territory without mutating the old state', () => {
    const base = createInitialState();
    const tiles = base.mapTiles.map((t) => ({ ...t, type: TileType.FOREST }));
    const at = (x: number, y: number) => y * 8 + x;
    tiles[at(0, 0)] = { ...tiles[at(0, 0)], discovered: true, claimed: true };
    tiles[at(1, 0)] = { ...tiles[at(1, 0)], discovered: true };
    tiles[at(5, 5)] = { ...tiles[at(5, 5)], discovered: true };
    const before = given({ ...base, mapTiles: tiles });

    expectRefused(actions.claimTile(2, 2), 'locked', before);
    expectRefused(actions.claimTile(5, 5), 'not_adjacent', before);
    expectRefused(actions.claimTile(0, 0), 'already_owned', before);

    const after = expectApplied(actions.claimTile(1, 0), before);
    expect(after.mapTiles[at(1, 0)].claimed).toBe(true);
    expect(after.territory.ownedTiles).toBeGreaterThan(before.territory.ownedTiles);
    expect(before.mapTiles[at(1, 0)].claimed).toBe(false);
  });
});

describe('space', () => {
  it('builds the ship once, then upgrades it to its max level', () => {
    let before = given(poor());
    expectRefused(actions.buildShip(), 'cannot_afford', before);
    expectRefused(actions.upgradeShip(), 'locked', before);

    before = given(rich());
    let after = expectApplied(actions.buildShip(), before);
    expect(after.spaceship.level).toBeGreaterThan(0);
    expectRefused(actions.buildShip(), 'already_owned', after);

    after = expectApplied(actions.upgradeShip(), after);
    expect(after.spaceship.level).toBeGreaterThan(1);

    before = given(rich({ spaceship: { level: MAX_SHIP_LEVEL, fuel: 0, maxFuel: 100 } }));
    expectRefused(actions.upgradeShip(), 'max_level', before);
  });

  it('launches a probe as a running exploration with a sequential id', () => {
    let before = given(rich());
    expectRefused(actions.launchProbe('Mars'), 'locked', before);

    const base = rich({ spaceship: { level: 1, fuel: 100, maxFuel: 100 } });
    before = given({ ...base, soldiers: { ...base.soldiers, scouts: 0 } });
    expectRefused(actions.launchProbe('Mars'), 'no_soldiers', before);

    before = given({ ...base, soldiers: { ...base.soldiers, scouts: 10 } });
    const after = expectApplied(actions.launchProbe('Mars'), before);
    const probe = after.spaceProbes[after.spaceProbes.length - 1];
    expect(probe.status).toBe('running');
    expect(probe.remainingMs).toBeGreaterThan(0);
    expect(probe.id).toBe(`probe_${before.nextIds.probe}`);
    expect(after.nextIds.probe).toBe(before.nextIds.probe + 1);

    for (let i = 1; i < MAX_PROBES; i++) actions.launchProbe('Mars');
    const full = gameState.value;
    expectRefused(actions.launchProbe('Mars'), 'slots_full', full);
  });
});

describe('prestige', () => {
  it('refuses to prestige before the requirements are met', () => {
    const before = given(poor());
    expectRefused(actions.prestige(), 'not_ready', before);
  });

  it('prestiges once the requirements are met', () => {
    const base = rich();
    const before = given({
      ...base,
      phase: 'transcendence',
      buildings: {
        ...base.buildings,
        barracks: { level: 99, count: 1 },
        walls: { level: 99 },
        warehouse: { level: 99 },
      },
      prestige: {
        ...base.prestige,
        totalFoodProduced: LOTS,
        totalWoodProduced: LOTS,
        totalStoneProduced: LOTS,
        totalNectarProduced: LOTS,
      },
    });
    const after = expectApplied(actions.prestige(), before);
    expect(after.prestige.count).toBeGreaterThan(before.prestige.count);
  });

  it('buys a prestige tree upgrade once', () => {
    const upgrade = PRESTIGE_UPGRADES.find((u) => !u.phaseRequired)!;
    let before = given(poor({ phase: 'transcendence' }));
    expectRefused(actions.buyPrestigeUpgrade(upgrade.id), 'cannot_afford', before);

    before = given(rich({ phase: 'transcendence' }));
    const after = expectApplied(actions.buyPrestigeUpgrade(upgrade.id), before);
    expect(after.prestigeTree.purchased).toContain(upgrade.id);
    expectRefused(actions.buyPrestigeUpgrade(upgrade.id), 'already_owned', after);
  });
});

describe('decisions (Story 1.28)', () => {
  const withOpen = (s: GameState, id: 'overcrowding' | 'scout_report'): GameState => ({
    ...s,
    decision: { open: { id, remainingMs: null, openedAtSessionMs: 0, roll: 0.99 }, nextSpawnSessionMs: null },
  });

  it('refuses when no event is open, or the choice is unknown', () => {
    let before = given(rich());
    expectRefused(actions.chooseDecision('expand'), 'not_running', before);
    before = given(withOpen(rich(), 'overcrowding'));
    expectRefused(actions.chooseDecision('nope'), 'unknown_id', before);
  });

  it('refuses a choice the colony cannot pay for', () => {
    const before = given(withOpen(poor(), 'overcrowding'));
    expectRefused(actions.chooseDecision('expand'), 'cannot_afford', before);
  });

  it('applies the choice through applyChoice, closes the event, then announces it', () => {
    const before = given(withOpen(rich(), 'overcrowding'));
    const seen: Array<{ open: unknown; choice: string; timedOut: boolean }> = [];
    bus.subscribe('decision_resolved', (p) => seen.push({ open: gameState.value.decision.open, choice: p.choice, timedOut: p.timedOut }));
    const after = expectApplied(actions.chooseDecision('expand'), before);
    expect(after).toEqual(applyChoice(before, getDecision('overcrowding'), 'expand'));
    expect(after.decision.open).toBeNull();
    expect(seen).toEqual([{ open: null, choice: 'expand', timedOut: false }]);
  });

  it('an unavoidable event can still be answered', () => {
    const before = given(withOpen(rich(), 'scout_report'));
    expect(expectApplied(actions.chooseDecision('stay_hidden'), before).decision.open).toBeNull();
  });
});

describe('phase (Story 1.19: CONTINUE)', () => {
  const latched = (s: GameState): GameState => ({
    ...s,
    phaseGoal: { phase: 'colony', latched: true, atMs: 0, reached: {} },
  });

  it('refuses CONTINUE while no goal is latched, even if the guard holds now', () => {
    const before = given(rich({ phase: 'egg_laying' }));
    expectRefused(actions.continuePhase(), 'not_ready', before);
  });

  it('commits the latched goal: next phase, latch cleared, phase_committed after the write', () => {
    const before = given(latched(rich({ phase: 'egg_laying' })));
    const seen: { to: string; statePhase: string }[] = [];
    bus.subscribe('phase_committed', ({ to }) => seen.push({ to, statePhase: gameState.value.phase }));
    const after = expectApplied(actions.continuePhase(), before);
    expect(after.phase).not.toBe(before.phase);
    expect(after.phase).toBe(before.phaseGoal!.phase);
    expect(after.phaseGoal).toBeNull();
    expect(seen).toEqual([{ to: after.phase, statePhase: after.phase }]);
  });

  it('still commits after the numbers dipped below target', () => {
    const before = given(latched(poor({ phase: 'egg_laying' })));
    const after = expectApplied(actions.continuePhase(), before);
    expect(after.phase).toBe(before.phaseGoal!.phase);
  });

  it('commits once: a second CONTINUE is refused', () => {
    given(latched(rich({ phase: 'egg_laying' })));
    actions.continuePhase();
    const after = gameState.value;
    expectRefused(actions.continuePhase(), 'not_ready', after);
  });

  it('prestige clears the latch', () => {
    const base = rich();
    const before = given({
      ...base,
      phase: 'transcendence',
      phaseGoal: { phase: 'transcendence', latched: true, atMs: 0, reached: {} },
      buildings: {
        ...base.buildings,
        barracks: { level: 99, count: 1 },
        walls: { level: 99 },
        warehouse: { level: 99 },
      },
      prestige: {
        ...base.prestige,
        totalFoodProduced: LOTS,
        totalWoodProduced: LOTS,
        totalStoneProduced: LOTS,
        totalNectarProduced: LOTS,
      },
    });
    const after = expectApplied(actions.prestige(), before);
    expect(after.phaseGoal).toBeNull();
  });
});

describe('phase reveal (Story 1.20: lifetime.revealsSeen)', () => {
  it('records a reveal as seen, once', () => {
    const before = given(rich({ phase: 'colony' }));
    const after = expectApplied(actions.markRevealSeen('colony' as never), before);
    expect(after.lifetime.revealsSeen).toContain('colony');
    expectRefused(actions.markRevealSeen('colony' as never), 'already_owned', after);
  });

  it('keeps the seen reveals through prestige', () => {
    const base = rich();
    const before = given({
      ...base,
      phase: 'transcendence',
      lifetime: { revealsSeen: ['colony', 'combat'] },
      buildings: {
        ...base.buildings,
        barracks: { level: 99, count: 1 },
        walls: { level: 99 },
        warehouse: { level: 99 },
      },
      prestige: {
        ...base.prestige,
        totalFoodProduced: LOTS,
        totalWoodProduced: LOTS,
        totalStoneProduced: LOTS,
        totalNectarProduced: LOTS,
      },
    });
    const after = expectApplied(actions.prestige(), before);
    expect(after.lifetime.revealsSeen).toEqual(before.lifetime.revealsSeen);
  });
});
