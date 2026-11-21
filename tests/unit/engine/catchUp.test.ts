import { describe, expect, it } from 'vitest';
import { catchUp, type CatchUpDeps } from '../../../src/engine/catchUp';
import { EventBus } from '../../../src/engine/EventBus';
import { ResourceSystem } from '../../../src/systems/ResourceSystem';
import { SoldierSystem } from '../../../src/systems/SoldierSystem';
import { MapSystem } from '../../../src/systems/MapSystem';
import { TerritorySystem } from '../../../src/systems/TerritorySystem';
import { PhaseStateMachine } from '../../../src/phases/PhaseStateMachine';
import { TRANSITIONS } from '../../../src/phases/transitions';
import { makeState } from '../helpers/makeState';

/**
 * The offline catch-up, shared by resume-on-load and the dev time skip
 * (Story 1.34): closed-form resources plus ticks for everything else; it may
 * latch a goal but never commits a phase.
 */

function deps(): CatchUpDeps {
  const bus = new EventBus();
  const fsm = new PhaseStateMachine(TRANSITIONS);
  return {
    resourceSystem: new ResourceSystem(bus),
    soldierSystem: new SoldierSystem(bus),
    mapSystem: new MapSystem(),
    territorySystem: new TerritorySystem(),
    latch: (s) => fsm.latch(s),
  };
}

describe('catchUp', () => {
  it('advances the colony: gatherers bring food, eggs hatch, game time passes', () => {
    const before = makeState({
      phase: 'colony',
      resources: { workers: 10, food: 100, eggs: 20 },
      eggPipeline: { count: 20, progress: 0 },
      workersAssigned: { gather: 10 },
    });
    const after = catchUp(before, 60_000, 1200, deps());
    expect(after.resources.food).toBeGreaterThan(before.resources.food);
    expect(after.eggPipeline.count).toBeLessThan(before.eggPipeline.count);
    expect(after.stats.playTimeMs).toBeGreaterThan(before.stats.playTimeMs);
    expect(after.phase).toBe(before.phase);
  });

  it('runs no ticks for nothing and never writes in place', () => {
    const before = makeState();
    const snapshot = JSON.stringify(before);
    catchUp(before, 1000, 20, deps());
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});
