// @vitest-environment node
/**
 * Story 4.4 (FR12): a bigger army has a real cost.
 *
 * Every combat soldier takes a worker to train and eats food while it lives
 * (in training too: the worker has left the workforce). The values live in
 * `data/balance/combat.ts` (`combatBalance.army`); these tests read them and
 * never restate them. A starving colony trains no new soldiers, and says so.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { gameState } from '../../src/state/gameSignal';
import { createInitialState, type GameState } from '../../src/state/GameState';
import { EventBus } from '../../src/engine/EventBus';
import { EventQueue } from '../../src/engine/events';
import { processTick } from '../../src/engine/processTick';
import { createActions, type Actions } from '../../src/actions';
import { ResourceSystem, armyUpkeepPerSec, computeResourceRates, isStarving } from '../../src/systems/ResourceSystem';
import { SoldierSystem } from '../../src/systems/SoldierSystem';
import { BattleSystem } from '../../src/systems/BattleSystem';
import { MapSystem } from '../../src/systems/MapSystem';
import { TerritorySystem } from '../../src/systems/TerritorySystem';
import { isFoodCritical } from '../../src/systems/NextAction';
import { combatBalance } from '../../src/data/balance/combat';
import { soldierBalance } from '../../src/data/balance/soldiers';
import { Phase } from '../../src/phases/phases';
import { REFUSAL_TEXT } from '../../src/ui/panels/refusal';

/** A Combat colony with `workers` idle workers, `food` in store and the given army. */
function colony(over: { workers?: number; food?: number; soldiers?: number; training?: number } = {}): GameState {
  const s = createInitialState();
  const workers = over.workers ?? 20;
  return {
    ...s,
    phase: Phase.COMBAT,
    resources: { ...s.resources, workers, nestCapacity: workers + 10, food: over.food ?? 1_000 },
    workersAssigned: { gather: 0, forage: 0, tend: 0, dig: 0, guard: 0, researchers: 0 },
    combatSoldiers: over.soldiers ?? 0,
    soldierPipeline: { count: over.training ?? 0, progress: 0 },
  };
}

const rates = (s: GameState) => computeResourceRates(s, new TerritorySystem().getBonuses(s));
const netFood = (s: GameState) => rates(s).foodProducedPerSec - rates(s).foodConsumedPerSec;

function tick(s: GameState, dtSec: number): GameState {
  const bus = new EventBus();
  return processTick(s, new ResourceSystem(bus), new SoldierSystem(bus), new MapSystem(), new TerritorySystem(), new EventQueue(), dtSec);
}

describe('the army balance lives in data/balance/combat.ts', () => {
  it('a soldier takes at least one whole worker and eats a positive amount of food', () => {
    expect(Number.isInteger(combatBalance.army.workersPerSoldier)).toBe(true);
    expect(combatBalance.army.workersPerSoldier).toBeGreaterThanOrEqual(1);
    expect(combatBalance.army.upkeepFoodPerSec).toBeGreaterThan(0);
  });
});

describe('every soldier alive eats food (upkeep)', () => {
  it('each soldier, trained or in training, adds its upkeep to the food eaten', () => {
    const none = colony();
    const armed = colony({ soldiers: 3, training: 2 });
    const eaten = (s: GameState) => rates(s).foodConsumedPerSec;
    expect(eaten(armed) - eaten(none)).toBeCloseTo(5 * combatBalance.army.upkeepFoodPerSec, 9);
    expect(armyUpkeepPerSec(armed)).toBeCloseTo(5 * combatBalance.army.upkeepFoodPerSec, 9);
    expect(armyUpkeepPerSec(none)).toBe(0);
  });

  it('a bigger army leaves less food after the same time', () => {
    const small = tick(colony({ soldiers: 1 }), 60);
    const big = tick(colony({ soldiers: 40 }), 60);
    expect(big.resources.food).toBeLessThan(small.resources.food);
    expect(Number.isInteger(big.resources.food)).toBe(true);
  });

  it('soldiers eat even when no worker is left', () => {
    const s = colony({ workers: 0, soldiers: 10, food: 500 });
    const after = tick(s, 60);
    expect(after.resources.food).toBeLessThan(s.resources.food);
  });

  it('training a soldier costs more food per second than the worker it replaces did', () => {
    // An idle worker feeds itself; a soldier makes nothing and eats.
    const before = colony();
    const after = new SoldierSystem(new EventBus()).recruitSoldier(before);
    expect(after).not.toBe(before);
    expect(netFood(after)).toBeLessThan(netFood(before));
  });

  it('a large enough army makes food critical where a small one does not', () => {
    const small = colony({ workers: 20, food: 200, soldiers: 1 });
    expect(isFoodCritical(small)).toBe(false);
    let big = small;
    for (let n = 2; n < 1_000 && !isFoodCritical(big); n++) big = colony({ workers: 20, food: 200, soldiers: n });
    expect(isFoodCritical(big)).toBe(true);
  });
});

describe('training takes a worker', () => {
  it('each soldier trained leaves the workforce `workersPerSoldier` workers smaller', () => {
    const before = colony();
    const after = new SoldierSystem(new EventBus()).recruitSoldier(before);
    expect(before.resources.workers - after.resources.workers).toBe(combatBalance.army.workersPerSoldier);
    expect(after.soldierPipeline.count).toBe(before.soldierPipeline.count + 1);
  });
});

describe('a starving colony trains no new soldiers', () => {
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

  /** An empty store and an army that eats more than the colony makes. */
  function starving(): GameState {
    let n = 1;
    let s = colony({ food: 0, soldiers: n });
    while (netFood(s) >= 0 && n < 1_000) s = colony({ food: 0, soldiers: ++n });
    expect(netFood(s), 'some army outeats the colony').toBeLessThan(0);
    return s;
  }

  it('starving means an empty store and more eaten than made', () => {
    const s = starving();
    expect(isStarving(s)).toBe(true);
    expect(isStarving(colony({ food: 0 }))).toBe(false);
    expect(isStarving({ ...s, resources: { ...s.resources, food: soldierBalance.costFood } })).toBe(false);
  });

  it('the action refuses with `starving` and writes nothing', () => {
    const before = starving();
    gameState.value = before;
    expect(actions.trainSoldier()).toEqual({ ok: false, reason: 'starving' });
    expect(gameState.value).toBe(before);
  });

  it('a colony that is not starving trains as before', () => {
    const before = colony({ food: 1_000 });
    gameState.value = before;
    expect(actions.trainSoldier()).toEqual({ ok: true });
    expect(gameState.value.soldierPipeline.count).toBeGreaterThan(before.soldierPipeline.count);
  });

  it('the refusal has words of its own', () => {
    expect(REFUSAL_TEXT.starving).toMatch(/STARV/);
  });
});
