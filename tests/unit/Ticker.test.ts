import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Ticker } from '../../src/engine/Ticker';

describe('Ticker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not tick before start is called', () => {
    const ticker = new Ticker();
    const callback = vi.fn();

    ticker.onTick(callback);
    vi.advanceTimersByTime(5000);

    expect(callback).not.toHaveBeenCalled();
  });

  it('ticks at 1-second intervals after start', () => {
    const ticker = new Ticker();
    const callback = vi.fn();

    ticker.onTick(callback);
    ticker.start();
    vi.advanceTimersByTime(3500);

    // 3 ticks at t=1s, t=2s, t=3s
    expect(callback).toHaveBeenCalledTimes(3);
  });

  it('stops ticking after stop is called', () => {
    const ticker = new Ticker();
    const callback = vi.fn();

    ticker.onTick(callback);
    ticker.start();
    vi.advanceTimersByTime(2500); // 2 ticks
    ticker.stop();
    vi.advanceTimersByTime(5000); // should produce 0 ticks after stop

    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('can start again after stop', () => {
    const ticker = new Ticker();
    const callback = vi.fn();

    ticker.onTick(callback);
    ticker.start();
    vi.advanceTimersByTime(1500); // 1 tick
    ticker.stop();
    ticker.start();
    vi.advanceTimersByTime(2500); // 2 ticks

    expect(callback).toHaveBeenCalledTimes(3);
  });

  it('supports multiple tick callbacks', () => {
    const ticker = new Ticker();
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    ticker.onTick(cb1);
    ticker.onTick(cb2);
    ticker.start();
    vi.advanceTimersByTime(1500); // 1 tick

    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it('does not start a second interval if already started', () => {
    const ticker = new Ticker();
    const callback = vi.fn();

    ticker.onTick(callback);
    ticker.start();
    ticker.start(); // second start should be a no-op
    vi.advanceTimersByTime(1500);

    expect(callback).toHaveBeenCalledTimes(1);
  });
});
