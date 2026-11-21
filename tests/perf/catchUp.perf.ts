import { describe, expect, it, vi } from 'vitest';
import { CATCH_UP_BUDGET_MS, HOUR_MS, OFFLINE_CAP_MAX_MS } from '../../src/data/constants';

/**
 * `pnpm perf` (Story 2.6, NFR4): how long the offline catch-up takes for a
 * 12 h and a 24 h absence, against the 500 ms budget (`CATCH_UP_BUDGET_MS`).
 * Not part of CI (vitest.perf.config.ts). The budget is for the reference phone
 * (about a 2022 mid-range Android): run this there, or on the phone open the
 * game with `?debug=1`, use the time-skip cheat and read CATCH-UP on the debug
 * overlay. On a desktop the numbers are a lower bound.
 */

// A Legacy node that raises the cap to its ceiling, so a 24 h absence is simulated whole.
const CAP_MAX_NODE = 'perf_cap_to_max';
vi.mock('../../src/data/prestigeTree', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/data/prestigeTree')>();
  const node = { ...actual.PRESTIGE_UPGRADES[0], id: CAP_MAX_NODE, offlineCapRaiseMs: OFFLINE_CAP_MAX_MS };
  return { ...actual, PRESTIGE_UPGRADES: [...actual.PRESTIGE_UPGRADES, node] };
});

const { resume } = await import('../../src/engine/resume');
const { EventBus } = await import('../../src/engine/EventBus');
const { ResourceSystem } = await import('../../src/systems/ResourceSystem');
const { SoldierSystem } = await import('../../src/systems/SoldierSystem');
const { MapSystem } = await import('../../src/systems/MapSystem');
const { TerritorySystem } = await import('../../src/systems/TerritorySystem');
const { PhaseStateMachine } = await import('../../src/phases/PhaseStateMachine');
const { TRANSITIONS } = await import('../../src/phases/transitions');
const { makeState } = await import('../unit/helpers/makeState');

type Deps = import('../../src/engine/catchUp').CatchUpDeps;

function deps(): Deps {
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

/** 50%, 75% (the run's offline research) or 100% (and the Legacy efficiency node), Story 2.8. */
const colony = (offlineEfficiency: number) =>
  makeState({
    phase: 'colony',
    resources: { workers: 40, food: 5_000, eggs: 30, larvae: 10 },
    eggPipeline: { count: 30, progress: 0 },
    larvaPipeline: { count: 10, progress: 0 },
    workersAssigned: { gather: 20, tend: 10 },
    research: offlineEfficiency >= 0.75 ? { projects: { dormantForaging: { status: 'done' } } } : {},
    prestigeTree: { purchased: offlineEfficiency >= 1 ? [CAP_MAX_NODE, 'temporal_resonance'] : [CAP_MAX_NODE] },
  });

const RUNS = 7;

function medianMs(hours: number, efficiency: number): number {
  const before = colony(efficiency);
  resume(before, hours * HOUR_MS, deps()); // warm-up
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const d = deps();
    const t0 = performance.now();
    resume(before, hours * HOUR_MS, d);
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(RUNS / 2)];
}

describe('catch-up time (pnpm perf, not CI)', () => {
  for (const hours of [12, 24]) {
    for (const efficiency of [0.5, 1]) {
      it(`${hours} h at ${efficiency * 100}% stays under ${CATCH_UP_BUDGET_MS} ms`, () => {
        const ms = medianMs(hours, efficiency);
        // The report: one line per case.
        process.stdout.write(`[perf] catch-up ${hours} h @ ${efficiency * 100}%: ${ms.toFixed(1)} ms (budget ${CATCH_UP_BUDGET_MS} ms)\n`);
        expect(ms).toBeLessThan(CATCH_UP_BUDGET_MS);
      });
    }
  }
});
