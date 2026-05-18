import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { Ticker } from '../../src/engine/Ticker';
import { StateManager } from '../../src/state/StateManager';
import { GameLoop } from '../../src/engine/GameLoop';

describe('GameLoop', () => {
  let bus: EventBus;
  let ticker: Ticker;
  let manager: StateManager;

  beforeEach(() => {
    vi.useFakeTimers();
    bus = new EventBus();
    ticker = new Ticker();
    manager = new StateManager(bus);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('start begins the ticker', () => {
    const loop = new GameLoop(bus, ticker, manager);
    const tickSpy = vi.spyOn(ticker, 'start');

    loop.start();

    expect(tickSpy).toHaveBeenCalled();
  });

  it('registers a tick handler that processes game logic', () => {
    const loop = new GameLoop(bus, ticker, manager);
    const callback = vi.fn();

    loop.onRender(callback);
    loop.start();
    vi.advanceTimersByTime(1500); // 1 tick at 1s

    // The render callback should have been called after the tick
    expect(callback).toHaveBeenCalledTimes(1);
    // State should have been passed to the render
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({
      phase: 'egg_laying',
    }));
  });

  it('stop stops the ticker', () => {
    const loop = new GameLoop(bus, ticker, manager);
    const tickSpy = vi.spyOn(ticker, 'stop');
    const callback = vi.fn();

    loop.onRender(callback);
    loop.start();
    loop.stop();

    expect(tickSpy).toHaveBeenCalled();
    // No more ticks after stop
    vi.advanceTimersByTime(5000);
    expect(callback).toHaveBeenCalledTimes(0);
  });

  it('tick increments playTimeMs each second', () => {
    const loop = new GameLoop(bus, ticker, manager);

    loop.start();
    vi.advanceTimersByTime(3500); // 3 ticks

    const state = manager.getState();
    expect(state.stats.playTimeMs).toBe(3000);
  });
});
