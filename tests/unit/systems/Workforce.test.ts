import { describe, it, expect } from 'vitest';
import {
  assignedTotal,
  freeWorkers,
  getReallocation,
  moveWorkers,
  roleCount,
  stepRole,
  workforceTotal,
  type Reallocation,
} from '../../../src/systems/Workforce';
import { ROLES, rolesForPhase } from '../../../src/data/content/roles';
import { nextActionBalance } from '../../../src/data/balance/nextAction';
import { computeResourceRates } from '../../../src/systems/ResourceSystem';
import { TerritorySystem } from '../../../src/systems/TerritorySystem';
import { Phase, PHASE_ORDER } from '../../../src/phases/phases';
import type { GameState } from '../../../src/state/GameState';
import { makeState, type StateOverrides } from '../helpers/makeState';

/**
 * Story 1.23 (UX-DR15): the workforce rules behind WRKR. Roles come from the
 * role data; Research counts toward the assigned total; the WRKR primary
 * action is the single most useful reallocation, or none.
 */

const net = (s: GameState): number => {
  const r = computeResourceRates(s, new TerritorySystem().getBonuses(s));
  return r.foodProducedPerSec - r.foodConsumedPerSec;
};

function colony(over: StateOverrides = {}): GameState {
  return makeState({ phase: Phase.COLONY, resources: { workers: 10, food: 500, nestCapacity: 1000 }, ...over });
}

/** A colony whose food is critical: no stock, most workers on TEND (no food), a few free. */
function starving(over: StateOverrides = {}): GameState {
  return colony({ resources: { workers: 40, food: 0, nestCapacity: 1000 }, workersAssigned: { tend: 30 }, ...over });
}

const apply = (s: GameState, r: Reallocation): GameState => moveWorkers(s, r.from, r.to, r.count);

describe('role data (Story 1.23)', () => {
  it('has the five MVP roles, each with a label, and unique ids', () => {
    const ids = ROLES.map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining(['gather', 'tend', 'dig', 'guard', 'research']));
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of ROLES) expect(r.label).toMatch(/^[A-Z]+$/);
  });

  it('reveals roles by phase, never taking one away later', () => {
    let before: string[] = [];
    for (const p of PHASE_ORDER) {
      const now = rolesForPhase(p).map((r) => r.id);
      expect(now).toEqual(expect.arrayContaining(before));
      before = now;
    }
    expect(rolesForPhase(Phase.EGG_LAYING)).toEqual([]);
    expect(rolesForPhase(Phase.COLONY).map((r) => r.id)).toContain('gather');
  });
});

describe('workforce counts', () => {
  it('counts researchers in the workforce and the assigned total, not as free workers', () => {
    const s = colony({ resources: { workers: 10 }, workersAssigned: { gather: 3, researchers: 2 } });
    expect(workforceTotal(s)).toBe(s.resources.workers + s.workersAssigned.researchers);
    expect(assignedTotal(s)).toBe(3 + s.workersAssigned.researchers);
    expect(freeWorkers(s)).toBe(workforceTotal(s) - assignedTotal(s));
  });

  it('never reports negative free workers', () => {
    const s = colony({ resources: { workers: 2 }, workersAssigned: { gather: 5 } });
    expect(freeWorkers(s)).toBe(0);
  });
});

describe('stepRole', () => {
  for (const role of ['gather', 'research'] as const) {
    it(`moves free workers onto ${role} and back without changing the workforce`, () => {
      const s = colony();
      const up = stepRole(s, role, 4);
      expect(roleCount(up, role)).toBe(roleCount(s, role) + 4);
      expect(freeWorkers(up)).toBe(freeWorkers(s) - 4);
      expect(workforceTotal(up)).toBe(workforceTotal(s));
      expect(assignedTotal(up)).toBe(assignedTotal(s) + 4);
      const down = stepRole(up, role, -4);
      expect(roleCount(down, role)).toBe(roleCount(s, role));
      expect(freeWorkers(down)).toBe(freeWorkers(s));
    });
  }

  it('leaves the state alone for a step it cannot take', () => {
    const s = colony({ workersAssigned: { gather: 2 } });
    expect(stepRole(s, 'gather', freeWorkers(s) + 1)).toBe(s);
    expect(stepRole(s, 'gather', -3)).toBe(s);
    expect(stepRole(s, 'gather', 0)).toBe(s);
    expect(stepRole(s, 'gather', 1.5)).toBe(s);
  });

  it('writes new objects (spread), never the old ones', () => {
    const s = colony();
    const before = JSON.stringify(s);
    stepRole(s, 'research', 1);
    stepRole(s, 'tend', 1);
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('moveWorkers', () => {
  it('between roles keeps the free pool and the workforce', () => {
    const s = colony({ workersAssigned: { tend: 4, researchers: 2 } });
    for (const [from, to] of [['tend', 'gather'], ['research', 'dig']] as const) {
      const m = moveWorkers(s, from, to, 2);
      expect(roleCount(m, from)).toBe(roleCount(s, from) - 2);
      expect(roleCount(m, to)).toBe(roleCount(s, to) + 2);
      expect(freeWorkers(m)).toBe(freeWorkers(s));
      expect(workforceTotal(m)).toBe(workforceTotal(s));
    }
  });

  it('from the free pool assigns them', () => {
    const s = colony();
    const m = moveWorkers(s, 'free', 'gather', 3);
    expect(freeWorkers(m)).toBe(freeWorkers(s) - 3);
    expect(roleCount(m, 'gather')).toBe(roleCount(s, 'gather') + 3);
  });

  it('refuses a move it cannot make by returning the same state', () => {
    const s = colony({ workersAssigned: { tend: 1 } });
    expect(moveWorkers(s, 'tend', 'gather', 2)).toBe(s);
    expect(moveWorkers(s, 'free', 'gather', freeWorkers(s) + 1)).toBe(s);
    expect(moveWorkers(s, 'tend', 'tend', 1)).toBe(s);
  });
});

describe('getReallocation (the WRKR primary action)', () => {
  it('suggests nothing before Colony or when nothing is critical', () => {
    expect(getReallocation(makeState({ phase: Phase.EGG_LAYING, resources: { workers: 40, food: 0 } }))).toBeNull();
    expect(getReallocation(colony({ workersAssigned: { gather: 10 } }))).toBeNull();
  });

  it('when food is critical, moves free workers to GATHER: the fewest that stop the loss', () => {
    const s = starving();
    expect(net(s)).toBeLessThan(0);
    const r = getReallocation(s)!;
    expect(r).toMatchObject({ rule: 'food', from: 'free', to: 'gather' });
    expect(r.count).toBeGreaterThan(0);
    expect(r.count).toBeLessThanOrEqual(freeWorkers(s));
    const after = apply(s, r);
    expect(net(after) >= 0 || r.count === freeWorkers(s)).toBe(true);
    if (r.count > 1) expect(net(moveWorkers(s, 'free', 'gather', r.count - 1))).toBeLessThan(0);
  });

  it('with no free workers, takes them from a job that makes no food', () => {
    const s = starving({ workersAssigned: { tend: 40 } });
    expect(freeWorkers(s)).toBe(0);
    const r = getReallocation(s)!;
    expect(r.rule).toBe('food');
    expect(r.from).toBe('tend');
    expect(r.to).toBe('gather');
    expect(net(apply(s, r))).toBeGreaterThan(net(s));
  });

  it('never takes the guards below the minimum', () => {
    const s = starving({ workersAssigned: { tend: 0, guard: 40 } });
    const r = getReallocation(s);
    if (r) {
      expect(r.from).toBe('guard');
      expect(roleCount(apply(s, r), 'guard')).toBeGreaterThanOrEqual(nextActionBalance.minGuards);
    }
    const none = starving({ resources: { workers: nextActionBalance.minGuards }, workersAssigned: { tend: 0, guard: nextActionBalance.minGuards } });
    expect(getReallocation(none)?.from).not.toBe('guard');
  });

  it('when the nest is full, moves free workers to DIG', () => {
    const cap = 100;
    const workers = Math.ceil((cap * nextActionBalance.capacityCriticalPercent) / 100);
    const s = colony({ resources: { workers, food: 100_000, nestCapacity: cap }, workersAssigned: { gather: 1 } });
    const r = getReallocation(s)!;
    expect(r).toMatchObject({ rule: 'capacity', from: 'free', to: 'dig' });
    expect(r.count).toBeLessThanOrEqual(freeWorkers(s));
    expect(roleCount(apply(s, r), 'dig')).toBeGreaterThan(0);
  });

  it('always suggests a move moveWorkers accepts', () => {
    const cases = [
      starving(),
      starving({ workersAssigned: { tend: 40 } }),
      starving({ workersAssigned: { dig: 20, tend: 15 } }),
      colony({ resources: { workers: 99, food: 100_000, nestCapacity: 100 } }),
      colony({ resources: { workers: 99, food: 100_000, nestCapacity: 100 }, workersAssigned: { gather: 60, tend: 39 } }),
    ];
    for (const s of cases) {
      const r = getReallocation(s);
      if (!r) continue;
      expect(r.count).toBe(Math.floor(r.count));
      expect(apply(s, r)).not.toBe(s);
    }
  });
});
