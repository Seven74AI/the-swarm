import { describe, expect, it } from 'vitest';
import { createInitialState, type GameState } from '../../src/state/GameState';
import { OFFLINE_CAP_BASE_MS, OFFLINE_CAP_MAX_MS } from '../../src/data/constants';
import { PRESTIGE_UPGRADES, type PrestigeUpgrade } from '../../src/data/prestigeTree';
import { getOfflineCapMs, planOffline } from '../../src/systems/OfflineProgression';
import { catchUp, type CatchUpDeps } from '../../src/engine/catchUp';
import { EventBus } from '../../src/engine/EventBus';
import { ResourceSystem } from '../../src/systems/ResourceSystem';
import { SoldierSystem } from '../../src/systems/SoldierSystem';
import { MapSystem } from '../../src/systems/MapSystem';
import { TerritorySystem } from '../../src/systems/TerritorySystem';
import { PhaseStateMachine } from '../../src/phases/PhaseStateMachine';
import { TRANSITIONS } from '../../src/phases/transitions';
import { createResumePath, resume, type ResumeResult } from '../../src/engine/resume';
import { makeState } from './helpers/makeState';

/**
 * Story 2.4: one offline cap. `getOfflineCapMs(state)` is the only limit on
 * resumed time: the baseline from data/constants.ts plus the cap raises of
 * owned Legacy upgrades, never above the ceiling. Every offline path (the
 * resume path's cold start, return and frame gap; catch-up; the dev time skip
 * through catch-up) honours it.
 */

const owning = (purchased: string[]): GameState => ({ ...createInitialState(), prestigeTree: { purchased } });

/** A table with two cap-raise nodes (none ship until Story 2.8). */
const RAISE_A: PrestigeUpgrade = { ...PRESTIGE_UPGRADES[0], id: 'cap_a' as PrestigeUpgrade['id'], offlineCapRaiseMs: 60 * 60_000 };
const RAISE_B: PrestigeUpgrade = { ...PRESTIGE_UPGRADES[0], id: 'cap_b' as PrestigeUpgrade['id'], offlineCapRaiseMs: 2 * 60 * 60_000 };
const TABLE = [...PRESTIGE_UPGRADES, RAISE_A, RAISE_B];

describe('getOfflineCapMs', () => {
  it('is the baseline from data/constants.ts for a new run', () => {
    expect(getOfflineCapMs(createInitialState())).toBe(OFFLINE_CAP_BASE_MS);
    expect(OFFLINE_CAP_BASE_MS).toBeGreaterThan(0);
    expect(OFFLINE_CAP_MAX_MS).toBeGreaterThanOrEqual(OFFLINE_CAP_BASE_MS);
  });

  it('no upgrade that ships today raises it', () => {
    expect(getOfflineCapMs(owning(PRESTIGE_UPGRADES.map((u) => u.id)))).toBe(OFFLINE_CAP_BASE_MS);
  });

  it('sums the raises of owned upgrades only', () => {
    const base = getOfflineCapMs(owning([]), TABLE);
    const a = getOfflineCapMs(owning(['cap_a']), TABLE);
    const ab = getOfflineCapMs(owning(['cap_a', 'cap_b']), TABLE);
    expect(a).toBeGreaterThan(base);
    expect(ab).toBeGreaterThan(a);
    expect(ab - base).toBe(RAISE_A.offlineCapRaiseMs! + RAISE_B.offlineCapRaiseMs!);
  });

  it('never exceeds the ceiling', () => {
    const huge: PrestigeUpgrade = { ...RAISE_A, id: 'cap_huge' as PrestigeUpgrade['id'], offlineCapRaiseMs: OFFLINE_CAP_MAX_MS * 4 };
    expect(getOfflineCapMs(owning(['cap_huge']), [...TABLE, huge])).toBe(OFFLINE_CAP_MAX_MS);
  });

  it('tolerates a save without a prestige tree', () => {
    const s = { ...createInitialState(), prestigeTree: undefined } as unknown as GameState;
    expect(getOfflineCapMs(s)).toBe(OFFLINE_CAP_BASE_MS);
  });
});

describe('planOffline', () => {
  const s = createInitialState();
  const cap = getOfflineCapMs(s);

  it('simulates the whole gap when it is under the cap, and says the cap was not reached', () => {
    const p = planOffline(s, cap - 60_000, 1);
    expect(p.effectiveMs).toBe(cap - 60_000);
    expect(p.capped).toBe(false);
    expect(p.capMs).toBe(cap);
  });

  it('simulates at most the cap of a longer gap, and says which cap applied', () => {
    for (const gap of [cap + 1, cap * 2, cap * 10]) {
      const p = planOffline(s, gap, 1);
      expect(p.elapsedMs).toBe(gap);
      expect(p.effectiveMs).toBe(cap);
      expect(p.capped).toBe(true);
      expect(p.capMs).toBe(cap);
    }
  });

  it('a raised cap lets more of the gap through', () => {
    const raised = owning(['cap_b']);
    const p = planOffline(raised, cap * 3, 1, TABLE);
    expect(p.capMs).toBeGreaterThan(cap);
    expect(p.effectiveMs).toBe(p.capMs);
  });

  it('runs fewer ticks at lower efficiency, never more than the capped time holds', () => {
    const full = planOffline(s, cap * 2, 1);
    const half = planOffline(s, cap * 2, 0.5);
    expect(half.offlineTicks).toBeLessThan(full.offlineTicks);
    expect(full.offlineTicks).toBeLessThanOrEqual(Math.floor(cap / 50));
    expect(Number.isInteger(half.offlineTicks)).toBe(true);
  });

  it('treats a negative gap (clock skew) as nothing', () => {
    const p = planOffline(s, -5000, 1);
    expect(p.effectiveMs).toBe(0);
    expect(p.offlineTicks).toBe(0);
    expect(p.capped).toBe(false);
  });
});

function deps(): CatchUpDeps {
  const bus = new EventBus();
  const fsm = new PhaseStateMachine(TRANSITIONS);
  return {
    resourceSystem: new ResourceSystem(bus),
    soldierSystem: new SoldierSystem(bus),
    mapSystem: new MapSystem(),
    territorySystem: new TerritorySystem(),
    latch: (st) => fsm.latch(st),
  };
}

describe('catchUp honours the cap', () => {
  it('a gap past the cap produces what the cap produces, whatever the caller asks for', () => {
    const before = makeState({ phase: 'colony', resources: { workers: 10, food: 100 }, workersAssigned: { gather: 10 } });
    const cap = getOfflineCapMs(before);
    // No ticks: only the closed-form part runs, so the comparison stays cheap.
    const atCap = catchUp(before, cap, 0, deps());
    const past = catchUp(before, cap * 3, 0, deps());
    expect(atCap.resources.food).toBeGreaterThan(before.resources.food);
    expect(past.resources.food).toBe(atCap.resources.food);
    expect(past.prestige.totalFoodProduced).toBe(atCap.prestige.totalFoodProduced);
  });
});

describe('every resume honours the cap (Story 2.3 resume path)', () => {
  // Efficiency 0: no ticks run, so a gap of days stays cheap; the plan is what is checked.
  const idle = (): GameState => ({ ...makeState({ phase: 'colony', resources: { workers: 10, food: 100 }, workersAssigned: { gather: 10 } }), offlineEfficiency: 0 });

  it('simulates at most the cap of a long absence, and the summary knows it was reached', () => {
    const before = idle();
    const cap = getOfflineCapMs(before);
    const r = resume(before, cap * 2, deps());
    expect(r.elapsedMs).toBeGreaterThan(cap);
    expect(r.offline!.effectiveMs).toBe(cap);
    expect(r.offline!.capMs).toBe(cap);
    expect(r.offline!.capped).toBe(true);
    // A gap past the cap produces exactly what the cap produces.
    expect(r.state.resources.food).toBe(resume(before, cap, deps()).state.resources.food);
  });

  it('an absence under the cap is not capped', () => {
    const r = resume(idle(), 10 * 60_000, deps());
    expect(r.offline!.effectiveMs).toBe(r.offline!.elapsedMs);
    expect(r.offline!.capped).toBe(false);
  });

  it('cold start, return from hidden and a frame gap all go through the same cap', () => {
    const before = idle();
    const cap = getOfflineCapMs(before);
    const results: ResumeResult[] = [];
    let now = 1_000_000_000;
    let state = before;
    let running = true;
    const path = createResumePath({
      now: () => now,
      read: () => state,
      write: (s) => { state = s; },
      resume: (s, ms) => resume(s, ms, deps()),
      save: () => {},
      ticker: { start: () => { running = true; }, stop: () => { running = false; }, isRunning: () => running },
      onResumed: (r) => results.push(r),
    });
    path.coldStart(now - cap * 3);
    path.hide();
    now += cap * 3;
    path.show();
    path.frameGap(cap * 3);
    expect(results).toHaveLength(3);
    for (const r of results) {
      expect(r.offline!.effectiveMs).toBe(cap);
      expect(r.offline!.capped).toBe(true);
    }
  });
});
