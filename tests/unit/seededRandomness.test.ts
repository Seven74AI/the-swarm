import { describe, it, expect, vi, afterEach } from 'vitest';
import { createEmptyMap, createInitialState, type GameState } from '../../src/state/GameState';
import { peekEnemy } from '../../src/systems/EnemySystem';
import { processTick } from '../../src/engine/processTick';
import { createTickContext } from '../../src/engine/TickContext';
import { EventBus } from '../../src/engine/EventBus';
import { EventQueue } from '../../src/engine/events';
import { ResourceSystem } from '../../src/systems/ResourceSystem';
import { SoldierSystem } from '../../src/systems/SoldierSystem';
import { MapSystem } from '../../src/systems/MapSystem';
import { TerritorySystem } from '../../src/systems/TerritorySystem';
import { BattleSystem, type BattleOutcome } from '../../src/systems/BattleSystem';
import { launchExpedition } from '../../src/systems/ExpeditionSystem';
import { launchExploration, tickProbeSwarm, PROBE_SWARM_THRESHOLD } from '../../src/systems/ExplorationSystem';
import { tickDecisions } from '../../src/systems/DecisionSystem';
import { Phase } from '../../src/phases/phases';
import { TICK_MS } from '../../src/data/constants';
import { GameLoop } from '../../src/engine/GameLoop';
import { Ticker } from '../../src/engine/Ticker';
import { isRngState, rngFromSeed, rngStream } from '../../src/utils/rng';

/**
 * Story 3.1 (AR9, ADR 0005): every random outcome comes from the seed in the
 * save. The same state and seed replay the same battles, expeditions,
 * explorations, probe launches, map and decision events; Math.random is never
 * consulted by the simulation.
 */

function systems() {
  const bus = new EventBus();
  return {
    resources: new ResourceSystem(bus),
    soldiers: new SoldierSystem(bus),
    map: new MapSystem(),
    territory: new TerritorySystem(),
  };
}

function tick(state: GameState, dtSec: number): GameState {
  const s = systems();
  return processTick(state, s.resources, s.soldiers, s.map, s.territory, new EventQueue(), dtSec);
}

/** A space-phase game with something random pending in every system. */
function busyState(seed: number): GameState {
  let s = createInitialState();
  s = {
    ...s,
    phase: Phase.SPACE,
    seed,
    rng: rngFromSeed(seed),
    mapTiles: createEmptyMap(), // generated on the first tick
    resources: { ...s.resources, workers: 50, food: 5_000, nestCapacity: 200, surveyData: PROBE_SWARM_THRESHOLD + 4 },
    soldiers: { ...s.soldiers, scouts: 10, warriors: 6 },
  };
  s = launchExpedition(s, 3, 2, 'FOREST');
  s = launchExpedition(s, 2, 1, 'DANGER');
  s = launchExploration(s, 'Mars');
  return s;
}

function runTicks(state: GameState, n: number, dtSec = TICK_MS / 1000): GameState {
  let s = state;
  for (let i = 0; i < n; i++) s = tick(s, dtSec);
  return s;
}

afterEach(() => vi.restoreAllMocks());

describe('the generator state is in the game state', () => {
  it('a new game has a valid generator state', () => {
    expect(isRngState(createInitialState().rng)).toBe(true);
  });

  it('the tick context hands systems a stream that starts at the state it is given', () => {
    const ctx = createTickContext(0.05, 123_456);
    expect(ctx.rng.state).toBe(123_456);
    const first = ctx.rng.float();
    expect(rngStream(123_456).float()).toBe(first);
  });
});

describe('the live tick draws from ctx.rng', () => {
  it('opens ctx.rng on the state it reads, and a step that folds it back continues the sequence', () => {
    const run = () => {
      let state: GameState = { ...createInitialState(), rng: rngFromSeed(11) };
      const starts: number[] = [];
      const drawn: number[] = [];
      const tick = new GameLoop(new Ticker()).bindTick({
        read: () => state,
        step: (s, ctx) => {
          starts.push(ctx.rng.state);
          drawn.push(ctx.rng.float());
          return { ...s, rng: ctx.rng.state };
        },
        write: (s) => {
          state = s;
        },
        flush: () => {},
        onHalt: () => {},
      });
      for (let i = 0; i < 3; i++) tick(0.05);
      return { starts, drawn, rng: state.rng };
    };
    const a = run();
    expect(a.starts[0]).toBe(rngFromSeed(11));
    const r = rngStream(rngFromSeed(11));
    expect(a.drawn).toEqual([r.float(), r.float(), r.float()]);
    expect(a.rng).toBe(r.state);
    expect(run()).toEqual(a);
  });
});

describe('the same state and seed replay the same run', () => {
  it('ticks: two runs from the same state are identical, without Math.random', () => {
    const spy = vi.spyOn(Math, 'random');
    const a = runTicks(busyState(42), 400);
    const b = runTicks(busyState(42), 400);
    expect(spy).not.toHaveBeenCalled();
    expect(a).toEqual(b);
    // Something random actually happened: the map was generated, the expeditions came home.
    expect(a.mapTiles.some((t) => t.type !== 'empty')).toBe(true);
    expect(a.expeditions).toHaveLength(0);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
  });

  it('a different seed gives a different run', () => {
    const maps = new Set([1, 2, 3, 4].map((seed) => JSON.stringify(runTicks(busyState(seed), 1).mapTiles)));
    expect(maps.size).toBeGreaterThan(1);
  });

  it('battles: the same state gives the same battle; the generator advances', () => {
    const spy = vi.spyOn(Math, 'random');
    const battle = new BattleSystem(new EventBus());
    const state = { ...createInitialState(), combatSoldiers: 8, battlesWon: 6, rng: rngFromSeed(9) };
    const a = battle.resolveBattle(state);
    const b = battle.resolveBattle(state);
    expect(spy).not.toHaveBeenCalled();
    expect(a).toEqual(b);
    expect(a.newState.rng).not.toBe(state.rng);
    expect(a.newState.seed).toBe(state.seed);
    // The next battle draws on from the advanced state, not from the start again.
    const next = battle.resolveBattle({ ...a.newState, combatSoldiers: 8 });
    expect(next.newState.rng).not.toBe(a.newState.rng);
  });

  it('battles with a fixed seed still end in victory, defeat or draw, and vary with the seed', () => {
    const battle = new BattleSystem(new EventBus());
    const outcomes = new Set<BattleOutcome>();
    const results = new Set<string>();
    for (let seed = 0; seed < 60; seed++) {
      // The next enemy is drawn from the generator too (Story 4.1), as the battle before would have.
      const nextEnemy = peekEnemy(rngFromSeed(seed + 1), 6).type as GameState['nextEnemy'];
      const state = { ...createInitialState(), combatSoldiers: 3, battlesWon: 6, nextEnemy, rng: rngFromSeed(seed) };
      const { result } = battle.resolveBattle(state);
      outcomes.add(result.outcome);
      results.add(`${result.enemyType}/${result.soldiersLost}/${result.foodGained}`);
    }
    for (const o of outcomes) expect(['victory', 'defeat', 'draw']).toContain(o);
    expect(results.size).toBeGreaterThan(1);
  });

  it('decision events drawn from the tick stream replay the same spawn', () => {
    const run = () => {
      const ctx = createTickContext(1, rngFromSeed(5));
      const s = { ...createInitialState(), phase: Phase.COLONY };
      const input = { dtMs: 1000, shown: true, canSpawn: true, timers: 'normal' as const, rand: () => ctx.rng.float(), events: ctx.events };
      let out = tickDecisions(s, { ...input, sessionMs: 0 });
      out = tickDecisions(out, { ...input, sessionMs: 10 * 60_000 });
      return { decision: out.decision, rng: ctx.rng.state };
    };
    expect(run()).toEqual(run());
    expect(run().rng).not.toBe(rngFromSeed(5));
  });
});

describe('random outcomes do not depend on step length or resolution order', () => {
  it('expeditions come home the same in one 10 s step as in 200 ticks', () => {
    for (const seed of [1, 7, 99, 1234]) {
      const fine = runTicks(busyState(seed), 200);
      const coarse = tick(busyState(seed), (200 * TICK_MS) / 1000);
      expect(coarse.expeditions).toHaveLength(0);
      expect(coarse.soldiers).toEqual(fine.soldiers);
      expect(coarse.territory.ownedTiles).toBe(fine.territory.ownedTiles);
    }
  });

  it('probe launches are the same for one long step as for many short ones', () => {
    for (const seed of [3, 30, 300]) {
      const base = { ...createInitialState(), seed, rng: rngFromSeed(seed), resources: { ...createInitialState().resources, surveyData: PROBE_SWARM_THRESHOLD } };
      let fine = base;
      for (let t = 0; t < 40; t++) {
        fine = tickProbeSwarm(fine, TICK_MS / 1000);
        fine = { ...fine, stats: { ...fine.stats, playTimeMs: fine.stats.playTimeMs + TICK_MS } };
      }
      const coarse = tickProbeSwarm(base, (40 * TICK_MS) / 1000);
      expect(coarse.spaceExplorations.map((e) => e.destination)).toEqual(fine.spaceExplorations.map((e) => e.destination));
    }
  });
});
