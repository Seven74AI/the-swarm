import { describe, it, expect } from 'vitest';
import { createInitialState, type GameState } from '../../../src/state/GameState';
import { Phase } from '../../../src/phases/phases';
import { EventBus } from '../../../src/engine/EventBus';
import { EventQueue } from '../../../src/engine/events';
import { processTick } from '../../../src/engine/processTick';
import { ResourceSystem, computeResourceRates, getAssignedWorkers } from '../../../src/systems/ResourceSystem';
import { SoldierSystem } from '../../../src/systems/SoldierSystem';
import { MapSystem } from '../../../src/systems/MapSystem';
import { TerritorySystem } from '../../../src/systems/TerritorySystem';
import { ROLES, rolesForPhase } from '../../../src/data/content/roles';
import { roleBalance } from '../../../src/data/balance/roles';
import { stepRole } from '../../../src/systems/Workforce';
import { MS_PER_SEC } from '../../../src/data/constants';
import { digBalance } from '../../../src/data/balance/dig';
import { roomCost } from '../../../src/systems/Dig';

/**
 * Story 3.4 (FR3, FR36): worker roles bring in wood, stone and nectar in
 * Colony, with no territory. Gather: food and wood. Forage: nectar. Dig: nest
 * capacity and stone. Every yield is credited in whole units.
 */

const bus = new EventBus();
const systems = {
  resource: new ResourceSystem(bus),
  soldier: new SoldierSystem(bus),
  map: new MapSystem(),
  territory: new TerritorySystem(),
};

/** A Colony nest with workers on the given roles and nothing else going on. */
function colony(roles: Partial<GameState['workersAssigned']>): GameState {
  const s = createInitialState();
  s.phase = Phase.COLONY;
  s.resources = { ...s.resources, workers: 30, food: 5_000, nestCapacity: 100 };
  s.workersAssigned = { ...s.workersAssigned, ...roles };
  return s;
}

/** Run live ticks for `seconds` of game time. */
function run(state: GameState, seconds: number, stepSec = 0.05): GameState {
  let s = state;
  const steps = Math.round(seconds / stepSec);
  for (let i = 0; i < steps; i++) {
    s = processTick(s, systems.resource, systems.soldier, systems.map, systems.territory, new EventQueue(), stepSec);
  }
  return s;
}

const noTerritory = (s: GameState) => s.mapTiles.every((t) => !t.claimed);

/** Seconds `workers` on a role need to bring in a few whole units at `perSec` each (read from the balance). */
const secondsFor = (perSec: number, workers: number) => Math.ceil(3 / (perSec * workers));
/** Seconds `workers` diggers need to dig one room. */
const roomSeconds = (workers: number) => Math.ceil(roomCost(0) / digBalance.diggerPointsPerSec / workers);

describe('worker roles produce the basic resources in Colony (Story 3.4)', () => {
  it('Gather brings in food and wood, with no territory', () => {
    const before = colony({ gather: 10 });
    expect(noTerritory(before)).toBe(true);
    const after = run(before, secondsFor(roleBalance.gatherWoodPerSec, 10), 1);
    expect(after.resources.wood).toBeGreaterThan(before.resources.wood);
    expect(after.resources.food).toBeGreaterThan(before.resources.food);
  });

  it('Forage brings in nectar, with no territory', () => {
    const before = colony({ forage: 10 });
    const after = run(before, secondsFor(roleBalance.forageNectarPerSec, 10), 1);
    expect(after.resources.nectar).toBeGreaterThan(before.resources.nectar);
  });

  it('Dig grows the nest and brings in stone, with no territory', () => {
    const before = colony({ dig: 10 });
    const after = run(before, Math.max(roomSeconds(10), secondsFor(roleBalance.digStonePerSec, 10)), 10);
    expect(after.resources.stone).toBeGreaterThan(before.resources.stone);
    expect(after.resources.nestCapacity).toBeGreaterThan(before.resources.nestCapacity);
  });

  it('a role with nobody on it yields nothing of its own resource', () => {
    const before = colony({ tend: 10, guard: 5 });
    const after = run(before, 10);
    expect(after.resources.wood).toBe(before.resources.wood);
    expect(after.resources.stone).toBe(before.resources.stone);
    expect(after.resources.nectar).toBe(before.resources.nectar);
  });

  it('more workers on a role yield more', () => {
    const few = computeResourceRates(colony({ gather: 2, forage: 2, dig: 2 }));
    const many = computeResourceRates(colony({ gather: 8, forage: 8, dig: 8 }));
    expect(many.woodPerSec).toBeGreaterThan(few.woodPerSec);
    expect(many.nectarPerSec).toBeGreaterThan(few.nectarPerSec);
    expect(many.stonePerSec).toBeGreaterThan(few.stonePerSec);
  });

  it('credits every yield in whole units, at any step length', () => {
    for (const stepSec of [0.05, 0.37, 10]) {
      let s = colony({ gather: 7, forage: 5, dig: 3 });
      for (let i = 0; i < 20; i++) {
        s = processTick(s, systems.resource, systems.soldier, systems.map, systems.territory, new EventQueue(), stepSec);
        for (const key of ['food', 'wood', 'stone', 'nectar', 'nestCapacity'] as const) {
          expect(Number.isInteger(s.resources[key]), `${key} at ${stepSec}s`).toBe(true);
        }
      }
    }
  });

  it('a forager is on a job: it neither idles for food nor counts as free', () => {
    const idle = colony({});
    const foraging = colony({ forage: 10 });
    expect(getAssignedWorkers(foraging)).toBe(getAssignedWorkers(idle) + 10);
    expect(computeResourceRates(foraging).foodProducedPerSec).toBeLessThan(computeResourceRates(idle).foodProducedPerSec);
  });

  it('territory still adds to wood, stone and nectar on top of the roles', () => {
    const s = colony({ gather: 5, forage: 5, dig: 5 });
    const roles = computeResourceRates(s);
    const withLand = computeResourceRates(s, { food: 0, wood: 1, stone: 1, nectar: 1 });
    expect(withLand.woodPerSec).toBeGreaterThan(roles.woodPerSec);
    expect(withLand.stonePerSec).toBeGreaterThan(roles.stonePerSec);
    expect(withLand.nectarPerSec).toBeGreaterThan(roles.nectarPerSec);
  });

  it('the yields live in the role balance file', () => {
    for (const v of Object.values(roleBalance)) expect(v).toBeGreaterThan(0);
  });
});

describe('the Forage role (Story 3.4)', () => {
  it('is in the role data, open from Colony, so WRKR shows its row', () => {
    const forage = ROLES.find((r) => r.id === 'forage');
    expect(forage).toBeDefined();
    expect(rolesForPhase(Phase.COLONY).map((r) => r.id)).toContain('forage');
    expect(rolesForPhase(Phase.EGG_LAYING).map((r) => r.id)).not.toContain('forage');
  });

  it('takes free workers and gives them back', () => {
    const s = colony({});
    const on = stepRole(s, 'forage', 4);
    expect(on.workersAssigned.forage).toBe(4);
    expect(stepRole(on, 'forage', -4).workersAssigned.forage).toBe(0);
  });

  it('a new game starts with nobody foraging', () => {
    expect(createInitialState().workersAssigned.forage).toBe(0);
  });
});
