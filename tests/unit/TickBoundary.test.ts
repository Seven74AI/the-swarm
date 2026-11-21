import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Ticker } from '../../src/engine/Ticker';
import { GameLoop, MAX_FAILED_TICKS, type TickBinding } from '../../src/engine/GameLoop';
import { EventBus } from '../../src/engine/EventBus';
import { createInitialState, type GameState } from '../../src/state/GameState';
import { processTick } from '../../src/engine/processTick';
import { ResourceSystem } from '../../src/systems/ResourceSystem';
import { SoldierSystem } from '../../src/systems/SoldierSystem';
import { MapSystem } from '../../src/systems/MapSystem';
import { TerritorySystem } from '../../src/systems/TerritorySystem';
import { log } from '../../src/utils/log';

/**
 * Story 1.17 (AR16): the tick boundary in GameLoop. A tick that throws leaves the
 * state reference as it was, drops the tick's queued events, logs through
 * `log.error`, and the next tick runs normally. Three failed ticks in a row stop
 * the simulation and call `onHalt` once.
 */

const DT = 0.05;

function harness(opts: { throwing: () => boolean }) {
  const bus = new EventBus();
  const resourceSystem = new ResourceSystem(bus);
  const soldierSystem = new SoldierSystem(bus);
  const mapSystem = new MapSystem();
  const territorySystem = new TerritorySystem();
  const realTick = resourceSystem.tick.bind(resourceSystem);
  // A system stubbed to throw whenever the test says so.
  vi.spyOn(resourceSystem, 'tick').mockImplementation((...args: Parameters<ResourceSystem['tick']>) => {
    if (opts.throwing()) throw new Error('system bug');
    return realTick(...args);
  });

  let state: GameState = createInitialState();
  const delivered: string[] = [];
  bus.subscribe('egg_clicked', () => delivered.push('egg_clicked'));

  const ticker = new Ticker();
  const loop = new GameLoop(ticker);
  const onHalt = vi.fn();
  const binding: TickBinding = {
    read: () => state,
    step: (s, ctx) => {
      // An event raised before the system runs: it must vanish if the tick fails.
      ctx.events.emit('egg_clicked', { amount: 1 } as never);
      return processTick(s, resourceSystem, soldierSystem, mapSystem, territorySystem, ctx.events, ctx.dtSec);
    },
    write: (s) => {
      state = s;
    },
    flush: (events) => events.flushTo(bus),
    onHalt,
  };
  const tick = loop.bindTick(binding);
  return { tick, loop, ticker, onHalt, delivered, get state() { return state; } };
}

describe('GameLoop tick boundary (Story 1.17)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    log.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('a throwing system discards the write, keeps the state reference, and logs the error', () => {
    let fail = true;
    const h = harness({ throwing: () => fail });
    const errorSpy = vi.spyOn(log, 'error');
    const before = h.state;

    expect(() => h.tick(DT)).not.toThrow();

    expect(h.state).toBe(before);
    expect(errorSpy).toHaveBeenCalled();
    expect(errorSpy.mock.calls[0][0]).toBe('tick');
    fail = false;
  });

  it("a failed tick's queued events are never delivered", () => {
    const h = harness({ throwing: () => true });
    h.tick(DT);
    expect(h.delivered).toEqual([]);
  });

  it('the next tick after a failure runs normally: it writes and flushes', () => {
    let fail = true;
    const h = harness({ throwing: () => fail });
    h.tick(DT);
    const kept = h.state;
    fail = false;

    h.tick(DT);

    expect(h.state).not.toBe(kept);
    expect(h.state.stats.playTimeMs).toBeGreaterThan(kept.stats.playTimeMs);
    expect(h.delivered.length).toBeGreaterThan(0);
    expect(h.loop.isHalted()).toBe(false);
  });

  it(`${MAX_FAILED_TICKS} consecutive failures halt the simulation once`, () => {
    const h = harness({ throwing: () => true });
    const stopSpy = vi.spyOn(h.ticker, 'stop');
    const before = h.state;

    for (let i = 0; i < MAX_FAILED_TICKS - 1; i++) h.tick(DT);
    expect(h.onHalt).not.toHaveBeenCalled();
    expect(h.loop.isHalted()).toBe(false);

    h.tick(DT);
    expect(h.onHalt).toHaveBeenCalledTimes(1);
    expect(h.loop.isHalted()).toBe(true);
    expect(stopSpy).toHaveBeenCalled();
    expect(h.state).toBe(before);

    // Once halted, further ticks do nothing and do not halt again.
    h.tick(DT);
    expect(h.onHalt).toHaveBeenCalledTimes(1);
    expect(h.state).toBe(before);
  });

  it('a good tick resets the failure count: only consecutive failures halt', () => {
    let fail = true;
    const h = harness({ throwing: () => fail });
    for (let i = 0; i < MAX_FAILED_TICKS - 1; i++) h.tick(DT);
    fail = false;
    h.tick(DT);
    fail = true;
    for (let i = 0; i < MAX_FAILED_TICKS - 1; i++) h.tick(DT);
    expect(h.loop.isHalted()).toBe(false);
    expect(h.onHalt).not.toHaveBeenCalled();
  });

  it('start and resume do not restart a halted simulation', () => {
    const h = harness({ throwing: () => true });
    for (let i = 0; i < MAX_FAILED_TICKS; i++) h.tick(DT);
    const startSpy = vi.spyOn(h.ticker, 'start');
    const resumeSpy = vi.spyOn(h.ticker, 'resume');
    h.loop.start();
    h.loop.resume();
    expect(startSpy).not.toHaveBeenCalled();
    expect(resumeSpy).not.toHaveBeenCalled();
  });

  it('a tick that returns the same state reference writes nothing', () => {
    const ticker = new Ticker();
    const loop = new GameLoop(ticker);
    const state = createInitialState();
    const write = vi.fn();
    const tick = loop.bindTick({ read: () => state, step: (s) => s, write, flush: () => {}, onHalt: () => {} });
    tick(DT);
    expect(write).not.toHaveBeenCalled();
  });
});
