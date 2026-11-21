// @vitest-environment node
/**
 * Story 1.6 (AR23): state with a lifecycle (research, battles, expeditions,
 * explorations) is a discriminated union on `status`, timed in game-time ms,
 * made by pure factories with sequential or content IDs, and survives
 * `JSON.parse(JSON.stringify(state))`.
 */
import { describe, expect, it, vi } from 'vitest';
import { createInitialState, type GameState } from '../../src/state/GameState';
import { EventBus } from '../../src/engine/EventBus';
import { createExpedition, launchExpedition, tickExpeditions } from '../../src/systems/ExpeditionSystem';
import { createExploration, createProbe, launchExploration, tickExplorations } from '../../src/systems/ExplorationSystem';
import { getProjects, startProject, tickResearch } from '../../src/systems/ResearchSystem';
import { BattleSystem } from '../../src/systems/BattleSystem';
import { migrateSave } from '../../src/persistence/migrations';
import type { SaveData } from '../../src/persistence/SaveManager';

const TICK_SEC = 0.05;

function withSoldiers(s: GameState): GameState {
  return { ...s, soldiers: { ...s.soldiers, scouts: 10, warriors: 10 } };
}

describe('lifecycle state (AR23)', () => {
  it('starts with every lifecycle idle', () => {
    const s = createInitialState();
    for (const p of Object.values(s.research.projects)) expect(p.status).toBe('idle');
    expect(s.lastBattle).toEqual({ status: 'idle' });
    expect(s.expeditions).toEqual([]);
    expect(s.spaceExplorations).toEqual([]);
    expect(s.spaceProbes).toEqual([]);
  });

  it('factories make plain data with sequential ids, no wall clock or randomness', () => {
    const now = vi.spyOn(Date, 'now');
    const rnd = vi.spyOn(Math, 'random');
    try {
      const s = createInitialState();
      const a = createExpedition(s, 1, 0, 'Meadow');
      const b = createExploration(s, 'Mars');
      const c = createProbe(s, 'Mars', 1);
      expect(a.id).toBe(`exp_${s.nextIds.expedition}`);
      expect(b.id).toBe(`spc_${s.nextIds.exploration}`);
      expect(c.id).toBe(`probe_${s.nextIds.probe}`);
      for (const x of [a, b, c]) {
        expect(x.status).toBe('running');
        expect(Number.isInteger(x.remainingMs)).toBe(true);
        expect(x.remainingMs).toBeGreaterThan(0);
        expect(JSON.parse(JSON.stringify(x))).toEqual(x);
      }
      expect(createExpedition(s, 1, 0, 'Meadow')).toEqual(a);
      expect(now).not.toHaveBeenCalled();
      expect(rnd).not.toHaveBeenCalled();
    } finally {
      now.mockRestore();
      rnd.mockRestore();
    }
  });

  it('launching gives each new instance the next id', () => {
    let s = withSoldiers(createInitialState());
    s = launchExpedition(s, 1, 0, 'Meadow');
    s = launchExpedition(s, 1, 0, 'Forest');
    expect(new Set(s.expeditions.map((e) => e.id)).size).toBe(2);
    s = launchExploration(s, 'Mars');
    s = launchExploration(s, 'Mars');
    expect(new Set(s.spaceExplorations.map((e) => e.id)).size).toBe(2);
  });

  it('running timers count down in game-time ms by the tick delta', () => {
    let s = withSoldiers(createInitialState());
    s = launchExploration(launchExpedition(s, 1, 0, 'Meadow'), 'Mars');
    const exp = s.expeditions[0].remainingMs;
    const spc = s.spaceExplorations[0].remainingMs;
    s = tickExplorations(tickExpeditions(s, TICK_SEC), TICK_SEC);
    expect(s.expeditions[0].remainingMs).toBeLessThan(exp);
    expect(s.spaceExplorations[0].remainingMs).toBeLessThan(spc);
    expect(exp - s.expeditions[0].remainingMs).toBe(TICK_SEC * 1000);
  });

  it('research runs in game-time ms and ends done', () => {
    const def = getProjects()[0];
    let s = createInitialState();
    s = {
      ...s,
      resources: Object.fromEntries(Object.keys(s.resources).map((k) => [k, 1_000_000])) as GameState['resources'],
      workersAssigned: { ...s.workersAssigned, researchers: def.requiredResearchers },
    };
    s = startProject(s, def.id);
    const running = s.research.projects[def.id];
    expect(running.status).toBe('running');
    if (running.status !== 'running') return;
    s = tickResearch(s, TICK_SEC);
    const next = s.research.projects[def.id];
    expect(next.status === 'running' && next.progressMs > running.progressMs).toBe(true);
    s = tickResearch(s, running.durationMs / 1000);
    expect(s.research.projects[def.id].status).toBe('done');
  });

  it('a battle is recorded as done, stamped with game time', () => {
    const now = vi.spyOn(Date, 'now');
    try {
      const s = { ...createInitialState(), combatSoldiers: 20, stats: { ...createInitialState().stats, playTimeMs: 42_000 } };
      const { newState } = new BattleSystem(new EventBus()).resolveBattle(s);
      expect(newState.lastBattle.status).toBe('done');
      if (newState.lastBattle.status === 'done') {
        expect(newState.lastBattle.atMs).toBe(s.stats.playTimeMs);
        expect(['victory', 'defeat', 'draw']).toContain(newState.lastBattle.result);
      }
      expect(now).not.toHaveBeenCalled();
    } finally {
      now.mockRestore();
    }
  });

  it('a state with every lifecycle in flight round-trips through JSON', () => {
    const def = getProjects()[0];
    let s = withSoldiers(createInitialState());
    s = {
      ...s,
      resources: Object.fromEntries(Object.keys(s.resources).map((k) => [k, 1_000_000])) as GameState['resources'],
      workersAssigned: { ...s.workersAssigned, researchers: def.requiredResearchers },
      combatSoldiers: 20,
    };
    s = startProject(s, def.id);
    s = launchExpedition(s, 1, 1, 'Forest');
    s = launchExploration(s, 'Mars');
    s = { ...s, spaceProbes: [createProbe(s, 'Mars', 1)] };
    s = new BattleSystem(new EventBus()).resolveBattle(s).newState;
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});

describe('save migration to lifecycle unions', () => {
  function v13(gameState: Record<string, unknown>): SaveData {
    return { version: 13, timestamp: 1, playTimeMs: 0, gameState: gameState as unknown as GameState };
  }

  it('converts tick timers, research states and the last battle', () => {
    const out = migrateSave(
      v13({
        stats: { totalEggsLaid: 0, totalClicks: 0, playTimeMs: 9_000 },
        research: {
          projects: {
            voidCrystalSynthesis: { state: 'completed', progress: 600 },
            antimatterContainment: { state: 'in_progress', progress: 30 },
            darkMatterDetection: { state: 'locked', progress: 0 },
          },
        },
        expeditions: [{ id: 'exp_1700_1', scouts: 1, warriors: 0, destination: 'Meadow', ticksRemaining: 40, risk: 0.3 }],
        spaceExplorations: [{ id: 'spc_1', destination: 'Mars', ticksRemaining: 20, risk: 0.3 }],
        spaceProbes: [{ id: 'probe_1700', destination: 'Mars', ticksRemaining: 10, scouts: 1 }],
        lastBattle: { enemyType: 'beetle', result: 'pending', soldiersLost: 1, foodGained: 2, timestamp: 1_700_000_000_000 },
        nextIds: { expedition: 2, exploration: 2, spaceship: 1 },
      }),
      13,
      14,
    );
    const gs = out.gameState;
    expect(out.version).toBe(14);
    expect(gs.research.projects.voidCrystalSynthesis).toEqual({ status: 'done' });
    expect(gs.research.projects.darkMatterDetection).toEqual({ status: 'idle' });
    const running = gs.research.projects.antimatterContainment;
    expect(running.status).toBe('running');
    if (running.status === 'running') {
      expect(running.progressMs).toBeGreaterThan(0);
      expect(running.durationMs).toBeGreaterThan(running.progressMs);
    }
    expect(gs.expeditions[0]).toMatchObject({ status: 'running', destination: 'Meadow' });
    expect(gs.expeditions[0].remainingMs).toBeGreaterThan(0);
    expect(gs.expeditions[0]).not.toHaveProperty('ticksRemaining');
    expect(gs.spaceExplorations[0]).toMatchObject({ status: 'running' });
    expect(gs.spaceProbes[0]).toMatchObject({ status: 'running' });
    expect(gs.lastBattle).toMatchObject({ status: 'done', enemyType: 'beetle', atMs: 9_000 });
    expect(gs.lastBattle).not.toHaveProperty('timestamp');
    expect(gs.nextIds.probe).toBeGreaterThan(0);
    expect(JSON.parse(JSON.stringify(gs))).toEqual(gs);
  });

  it('turns a missing battle into idle and tolerates missing fields', () => {
    const out = migrateSave(v13({ lastBattle: null }), 13, 14);
    expect(out.gameState.lastBattle).toEqual({ status: 'idle' });
  });
});
