import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Ticker } from '../../src/engine/Ticker';
import { GameLoop } from '../../src/engine/GameLoop';

describe('GameLoop', () => {
  let ticker: Ticker;

  beforeEach(() => {
    vi.useFakeTimers();
    ticker = new Ticker();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('start begins the ticker', () => {
    const loop = new GameLoop(ticker);
    const tickSpy = vi.spyOn(ticker, 'start');

    loop.start();

    expect(tickSpy).toHaveBeenCalled();
  });

  it('stop stops the ticker', () => {
    const loop = new GameLoop(ticker);
    const tickSpy = vi.spyOn(ticker, 'stop');

    loop.start();
    loop.stop();

    expect(tickSpy).toHaveBeenCalled();
  });
});
