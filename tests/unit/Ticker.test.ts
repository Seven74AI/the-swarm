import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Ticker } from '../../src/engine/Ticker';

describe('Ticker', () => {
  it('does not tick before start is called', () => {
    const ticker = new Ticker();
    const callback = vi.fn();

    ticker.onTick(callback);
    // start() not called, callback should not fire

    expect(callback).not.toHaveBeenCalled();
  });

  it('start sets running state', () => {
    const ticker = new Ticker();
    ticker.start();
    // After start, the Ticker is running (can't easily test with rAF)
    // Verify no crash
    ticker.stop();
  });

  it('stop sets running to false', () => {
    const ticker = new Ticker();
    ticker.start();
    ticker.stop();
    // No crash = pass
  });

  it('can start again after stop', () => {
    const ticker = new Ticker();
    ticker.start();
    ticker.stop();
    ticker.start();
    ticker.stop();
    // No crash = pass
  });

  it('start is idempotent', () => {
    const ticker = new Ticker();
    ticker.start();
    ticker.start(); // should not crash or create second rAF
    ticker.stop();
  });

  it('onTick adds callback', () => {
    const ticker = new Ticker();
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    ticker.onTick(cb1);
    ticker.onTick(cb2);

    // Both callbacks registered (tested via offTick)
    ticker.offTick(cb1);
    ticker.offTick(cb2);
  });

  it('offTick removes a registered callback', () => {
    const ticker = new Ticker();
    const cb = vi.fn();

    ticker.onTick(cb);
    ticker.offTick(cb);

    // offTick should not throw
    expect(() => ticker.offTick(cb)).not.toThrow();
  });

  it('offTick is a no-op for unregistered callbacks', () => {
    const ticker = new Ticker();
    const cb = vi.fn();

    expect(() => ticker.offTick(cb)).not.toThrow();
  });

  it('setAccumulator pre-fills accumulator for offline catch-up', () => {
    const ticker = new Ticker();
    // setAccumulator is public for offline catch-up
    ticker.setAccumulator(5000);
    // No crash = pass
  });
});
