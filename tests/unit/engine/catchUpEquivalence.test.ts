// @ts-nocheck — fast-check type inference weak with noImplicitAny
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { CATCH_UP_STEP_MS, TICK_MS } from '../../../src/data/constants';

/**
 * Story 2.6 (AR4): the macro-stepped catch-up gives what fine steps give,
 * within the step-length tolerance Story 2.5 states
 * (tests/unit/helpers/stepTolerance.ts, reasoning in stepLength.test.ts).
 *
 * 1. Every macro-step catch-up actually takes (captured from its `processTick`
 *    calls) is within 2.5's tolerance of the 50 ms steps it replaces, run from
 *    the same state with the same arguments.
 * 2. End to end, the macro-stepped catch-up and a 50 ms catch-up agree: the
 *    same game time passes, the closed-form resources are equal, both keep
 *    2.5's integer invariants, and pipelines differ by at most the sum of
 *    2.5's per-window tolerance over the windows taken (pipelines are decay
 *    chains, so a window's difference is carried forward, never amplified).
 */

// Record processTick calls (arguments and result) without changing them.
vi.mock('../../../src/engine/processTick', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/engine/processTick')>();
  return { ...actual, processTick: vi.fn(actual.processTick) };
});

const recorded = await import('../../../src/engine/processTick');
const { processTick: realTick } = await vi.importActual<typeof import('../../../src/engine/processTick')>('../../../src/engine/processTick');
const { catchUp } = await import('../../../src/engine/catchUp');
const { EventBus } = await import('../../../src/engine/EventBus');
const { EventQueue } = await import('../../../src/engine/events');
const { ResourceSystem } = await import('../../../src/systems/ResourceSystem');
const { SoldierSystem } = await import('../../../src/systems/SoldierSystem');
const { MapSystem } = await import('../../../src/systems/MapSystem');
const { TerritorySystem } = await import('../../../src/systems/TerritorySystem');
const { PhaseStateMachine } = await import('../../../src/phases/PhaseStateMachine');
const { TRANSITIONS } = await import('../../../src/phases/transitions');
const { pipelineTolerance, stageRates, WHOLE_UNIT_CARRY } = await import('../helpers/stepTolerance');
const { makeState } = await import('../helpers/makeState');

const TICK_SEC = TICK_MS / 1000;
const SEED = 0x2606;

function deps() {
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

/** One step through the real processTick, the way catch-up calls it (deterministic resources skipped). */
function step(state, dtSec, skip = true) {
  const d = deps();
  return realTick(state, d.resourceSystem, d.soldierSystem, d.mapSystem, d.territorySystem, new EventQueue(), dtSec, skip);
}

function fine(state, dtSec) {
  const n = Math.round(dtSec / TICK_SEC);
  let s = state;
  for (let i = 0; i < n; i++) s = step(s, TICK_SEC);
  return s;
}

const arbColony = fc
  .record({
    workers: fc.integer({ min: 0, max: 120 }),
    headroom: fc.integer({ min: 0, max: 120 }),
    food: fc.integer({ min: 0, max: 20_000 }),
    eggs: fc.integer({ min: 0, max: 200 }),
    larvae: fc.integer({ min: 0, max: 200 }),
    eggProgress: fc.double({ min: 0, max: 0.999, noNaN: true }),
    larvaProgress: fc.double({ min: 0, max: 0.999, noNaN: true }),
    shares: fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 3, maxLength: 3 }),
    autoEggLayer: fc.boolean(),
  })
  .map((r) => {
    const total = r.shares.reduce((a, b) => a + b, 0) || 1;
    const part = (i: number) => Math.floor((r.workers * r.shares[i]) / total / 1.25);
    return makeState({
      phase: 'colony',
      resources: { workers: r.workers, nestCapacity: r.workers + r.headroom, food: r.food, eggs: r.eggs, larvae: r.larvae },
      eggPipeline: { count: r.eggs, progress: r.eggProgress },
      larvaPipeline: { count: r.larvae, progress: r.larvaProgress },
      workersAssigned: { gather: part(0), tend: part(1), dig: part(2) },
      prestigeTree: { purchased: r.autoEggLayer ? ['auto_egg_laying'] : [] },
    });
  });

/** 2.5's pipeline tolerance for one window of `T` seconds starting at `state`, as stepLength.test.ts states it. */
function windowTolerance(state, T, dug) {
  const k = stageRates(state, (s, dt) => step(s, dt));
  const kMax = Math.max(k.hatch, k.mature);
  return {
    eggs: pipelineTolerance(k.hatch, 1, T, k.inflow),
    larvae: pipelineTolerance(kMax, 2, T, k.inflow) + dug,
    workers: pipelineTolerance(kMax, 2, T, k.inflow) + dug,
  };
}

function expectIntegerInvariants(before, after, where) {
  for (const [key, value] of Object.entries(after.resources)) {
    expect(Number.isInteger(value), `${where}: resources.${key} = ${value} is an integer`).toBe(true);
    expect(value, `${where}: resources.${key} >= 0`).toBeGreaterThanOrEqual(0);
  }
  expect(after.resources.eggs, `${where}: every egg is in the egg pipeline`).toBe(after.eggPipeline.count);
  expect(after.resources.larvae, `${where}: every larva is in the larva pipeline`).toBe(after.larvaPipeline.count);
  const brood = (s) => s.resources.eggs + s.resources.larvae + s.resources.workers;
  const laid = after.stats.totalEggsLaid - before.stats.totalEggsLaid;
  expect(brood(after), `${where}: eggs + larvae + workers grow only by the eggs laid`).toBe(brood(before) + laid);
}

describe('macro-stepped catch-up matches fine-stepped (Story 2.6)', { timeout: 60_000 }, () => {
  beforeEach(() => {
    vi.mocked(recorded.processTick).mockClear();
  });

  it('takes macro-steps much longer than a game tick', () => {
    expect(CATCH_UP_STEP_MS / TICK_MS).toBeGreaterThanOrEqual(100);
  });

  it('each macro-step is within Story 2.5\'s tolerance of the 50 ms steps it replaces', () => {
    fc.assert(
      fc.property(arbColony, fc.integer({ min: 1, max: 4 }), (before, minutes) => {
        vi.mocked(recorded.processTick).mockClear();
        const ms = minutes * 60_000 + 3_250; // a short last step too
        catchUp(before, ms, Math.floor(ms / TICK_MS), deps());
        const calls = vi.mocked(recorded.processTick).mock.calls;
        const results = vi.mocked(recorded.processTick).mock.results;
        expect(calls.length).toBe(Math.ceil(ms / CATCH_UP_STEP_MS));
        calls.forEach((args, i) => {
          const [input, , , , , , dtSec, skip] = args;
          expect(skip).toBe(true);
          const macro = results[i].value;
          const reference = fine(input, dtSec);
          const where = `step ${i} (${dtSec} s)`;
          expectIntegerInvariants(input, macro, `${where}, macro`);
          const dug = macro.resources.nestCapacity - input.resources.nestCapacity;
          const tol = windowTolerance(input, dtSec, dug);
          for (const key of ['eggs', 'larvae', 'workers'] as const) {
            expect(Math.abs(macro.resources[key] - reference.resources[key]), `${where}: ${key}`).toBeLessThanOrEqual(tol[key]);
          }
          expect(Math.abs(macro.resources.nestCapacity - reference.resources.nestCapacity), `${where}: nest capacity`)
            .toBeLessThanOrEqual(WHOLE_UNIT_CARRY);
          expect(macro.stats.playTimeMs - input.stats.playTimeMs).toBeCloseTo(dtSec * 1000, 6);
        });
      }),
      { seed: SEED, numRuns: 15 },
    );
  });

  it('end to end, a macro-stepped catch-up agrees with a 50 ms one', () => {
    fc.assert(
      fc.property(arbColony, fc.integer({ min: 2, max: 20 }), (before, minutes) => {
        const ms = minutes * 60_000;
        const ticks = Math.floor(ms / TICK_MS);
        vi.mocked(recorded.processTick).mockClear();
        const macro = catchUp(before, ms, ticks, deps());
        const windows = vi.mocked(recorded.processTick).mock.calls.map((args, i) => ({
          input: args[0],
          dtSec: args[6],
          output: vi.mocked(recorded.processTick).mock.results[i].value,
        }));
        const fineRun = catchUp(before, ms, ticks, deps(), TICK_MS);

        // Same game time, same closed-form resources.
        expect(macro.stats.playTimeMs).toBeCloseTo(fineRun.stats.playTimeMs, 3);
        for (const key of ['food', 'wood', 'stone', 'nectar'] as const) {
          expect(macro.resources[key], key).toBe(fineRun.resources[key]);
        }
        expectIntegerInvariants(before, macro, 'macro');
        expectIntegerInvariants(before, fineRun, 'fine');
        expect(macro.phase).toBe(before.phase);

        // Pipelines: within the sum of 2.5's per-window tolerance over the windows taken.
        const sum = { eggs: 0, larvae: 0, workers: 0 };
        for (const w of windows) {
          const dug = w.output.resources.nestCapacity - w.input.resources.nestCapacity;
          const tol = windowTolerance(w.input, w.dtSec, dug);
          sum.eggs += tol.eggs;
          sum.larvae += tol.larvae;
          sum.workers += tol.workers;
        }
        for (const key of ['eggs', 'larvae', 'workers'] as const) {
          expect(Math.abs(macro.resources[key] - fineRun.resources[key]), `${key}: macro ${macro.resources[key]} vs fine ${fineRun.resources[key]}`)
            .toBeLessThanOrEqual(sum[key]);
        }
        expect(Math.abs(macro.resources.nestCapacity - fineRun.resources.nestCapacity)).toBeLessThanOrEqual(windows.length * WHOLE_UNIT_CARRY);
      }),
      { seed: SEED, numRuns: 15 },
    );
  });
});
