import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OFFLINE_CAP_MAX_MS, CATCH_UP_MAX_STEPS, CATCH_UP_STEP_MS } from '../../../src/data/constants';

/**
 * Story 2.6 (AR4, NFR4): the offline path of `resume(elapsedMs)` advances in
 * macro-steps through the same `processTick` the game uses. The CI gate is a
 * deterministic step budget: a 24 h catch-up calls `processTick` at most
 * `CATCH_UP_MAX_STEPS` times. Wall-clock time is never asserted here; `pnpm perf`
 * reports it against the 500 ms budget.
 */

// Count processTick calls without changing what they do.
vi.mock('../../../src/engine/processTick', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/engine/processTick')>();
  return { ...actual, processTick: vi.fn(actual.processTick) };
});

// A Legacy node that raises the cap to its ceiling, so a 24 h absence is simulated whole.
const CAP_MAX_NODE = 'test_cap_to_max';
vi.mock('../../../src/data/prestigeTree', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/data/prestigeTree')>();
  const node = { ...actual.PRESTIGE_UPGRADES[0], id: CAP_MAX_NODE, offlineCapRaiseMs: OFFLINE_CAP_MAX_MS };
  return { ...actual, PRESTIGE_UPGRADES: [...actual.PRESTIGE_UPGRADES, node] };
});

const { processTick } = await import('../../../src/engine/processTick');
const { resume } = await import('../../../src/engine/resume');
const { catchUp } = await import('../../../src/engine/catchUp');
const { getOfflineCapMs } = await import('../../../src/systems/OfflineProgression');
const { EventBus } = await import('../../../src/engine/EventBus');
const { ResourceSystem } = await import('../../../src/systems/ResourceSystem');
const { SoldierSystem } = await import('../../../src/systems/SoldierSystem');
const { MapSystem } = await import('../../../src/systems/MapSystem');
const { TerritorySystem } = await import('../../../src/systems/TerritorySystem');
const { PhaseStateMachine } = await import('../../../src/phases/PhaseStateMachine');
const { TRANSITIONS } = await import('../../../src/phases/transitions');
const { log } = await import('../../../src/utils/log');
const { makeState } = await import('../helpers/makeState');

type Deps = import('../../../src/engine/catchUp').CatchUpDeps;

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

/** A mid-game colony with every pipeline busy and the cap raised to its ceiling. */
const colony = (offlineEfficiency: number) =>
  makeState({
    phase: 'colony',
    offlineEfficiency,
    resources: { workers: 40, food: 5_000, eggs: 30, larvae: 10 },
    eggPipeline: { count: 30, progress: 0 },
    larvaPipeline: { count: 10, progress: 0 },
    workersAssigned: { gather: 20, tend: 10 },
    prestigeTree: { purchased: [CAP_MAX_NODE] },
  });

const DAY_PLUS = OFFLINE_CAP_MAX_MS + 6 * 60 * 60_000;

describe('catch-up step budget (Story 2.6)', () => {
  beforeEach(() => {
    vi.mocked(processTick).mockClear();
  });

  it('the macro-step is 10 s and the budget covers a full 24 h at that step', () => {
    expect(CATCH_UP_STEP_MS).toBeGreaterThan(50);
    expect(CATCH_UP_MAX_STEPS * CATCH_UP_STEP_MS).toBeGreaterThanOrEqual(OFFLINE_CAP_MAX_MS);
  });

  it('the test state really has the 24 h cap', () => {
    expect(getOfflineCapMs(colony(1))).toBe(OFFLINE_CAP_MAX_MS);
  });

  for (const efficiency of [0.5, 0.75, 1]) {
    it(`a 24 h catch-up at ${efficiency * 100}% calls processTick at most CATCH_UP_MAX_STEPS times`, () => {
      const before = colony(efficiency);
      const r = resume(before, DAY_PLUS, deps());
      expect(r.offline).not.toBeNull();
      expect(r.offline!.effectiveMs).toBe(OFFLINE_CAP_MAX_MS);
      const calls = vi.mocked(processTick).mock.calls.length;
      expect(calls).toBeGreaterThan(0);
      expect(calls).toBeLessThanOrEqual(CATCH_UP_MAX_STEPS);
      // Every macro-step is at most CATCH_UP_STEP_MS long.
      for (const call of vi.mocked(processTick).mock.calls) {
        expect(call[6]).toBeGreaterThan(0);
        expect(call[6] * 1000).toBeLessThanOrEqual(CATCH_UP_STEP_MS);
      }
    });
  }

  it('macro-steps still simulate the whole planned time (efficiency × ticks × 50 ms)', () => {
    for (const efficiency of [0.5, 1]) {
      const before = colony(efficiency);
      const r = resume(before, DAY_PLUS, deps());
      const simulated = r.state.stats.playTimeMs - before.stats.playTimeMs;
      expect(simulated).toBeCloseTo(r.offline!.offlineTicks * 50, 3);
    }
  });

  it('the dev time skip (catchUp with one tick per 50 ms) stays within the budget too', () => {
    const before = colony(1);
    catchUp(before, OFFLINE_CAP_MAX_MS, Math.floor(OFFLINE_CAP_MAX_MS / 50), deps());
    expect(vi.mocked(processTick).mock.calls.length).toBeLessThanOrEqual(CATCH_UP_MAX_STEPS);
  });

  it('logs one catch-up summary line, not one per step', () => {
    const before = colony(1);
    const marker = log.entries().at(-1);
    catchUp(before, OFFLINE_CAP_MAX_MS, Math.floor(OFFLINE_CAP_MAX_MS / 50), deps());
    const all = log.entries();
    const fresh = marker === undefined ? all : all.slice(all.lastIndexOf(marker) + 1);
    expect(fresh.map((e) => e.scope)).toEqual(['catch-up']);
  });
});
