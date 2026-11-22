import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/preact';
import { createFloatGate, useFloats, Floats } from '../../../../src/ui/primitives/floats';
import { feelBalance } from '../../../../src/data/balance/feel';

/**
 * Story 8.9 (UX-DR37): a floating `+N` appears at most
 * `feelBalance.floatMaxPerSec` times a second. What a held button gains
 * faster than that is added to the next `+N`, so nothing is lost.
 */

describe('float gate', () => {
  it('lets at most floatMaxPerSec floats through in any 1 s, and the amounts all arrive', () => {
    let t = 0;
    const gate = createFloatGate(() => t);
    const shown: { at: number; amount: number }[] = [];
    let offered = 0;
    // Faster than any hold repeat: every 20 ms for 3 s.
    for (t = 0; t < 3000; t += 20) {
      offered += 1;
      const n = gate.offer(1);
      if (n !== null) shown.push({ at: t, amount: n });
    }
    const rest = gate.drain();
    const total = shown.reduce((s, x) => s + x.amount, 0) + rest;
    expect(total).toBe(offered);
    expect(shown.length).toBeGreaterThan(0);
    for (const s of shown) {
      const inWindow = shown.filter((u) => u.at >= s.at && u.at < s.at + 1000).length;
      expect(inWindow).toBeLessThanOrEqual(feelBalance.floatMaxPerSec);
    }
  });

  it('a slow tap always floats at once', () => {
    let t = 0;
    const gate = createFloatGate(() => t);
    for (t = 0; t < 5000; t += 500) expect(gate.offer(2)).toBe(2);
  });

  it('nextAt says when a held-back amount may float', () => {
    let t = 0;
    const gate = createFloatGate(() => t);
    for (let i = 0; i < feelBalance.floatMaxPerSec; i += 1) gate.offer(1);
    expect(gate.offer(1)).toBeNull();
    expect(gate.nextAt()).toBeGreaterThan(t);
  });
});

function Probe({ onReady }: { onReady: (spawn: (n: number) => void) => void }) {
  const floats = useFloats();
  onReady((n) => floats.spawn(n));
  return <Floats floats={floats.list} unit="EGG" />;
}

describe('useFloats', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('shows at most floatMaxPerSec +N in a second; the held-back amount floats later', () => {
    let spawn: (n: number) => void = () => {};
    const { container } = render(<Probe onReady={(s) => (spawn = s)} />);
    const created: string[] = [];
    const seen = new Set<Element>();
    const record = () => {
      for (const el of container.querySelectorAll('[data-float]')) if (!seen.has(el)) (seen.add(el), created.push(el.textContent ?? ''));
    };
    for (let i = 0; i < 30; i += 1) {
      act(() => spawn(1));
      record();
      act(() => void vi.advanceTimersByTime(10));
      record();
    }
    expect(created.length).toBeLessThanOrEqual(feelBalance.floatMaxPerSec);
    for (let i = 0; i < 20; i += 1) {
      act(() => void vi.advanceTimersByTime(100));
      record();
    }
    const sum = created.reduce((s, text) => s + Number(/\+(\d+)/.exec(text)?.[1] ?? 0), 0);
    expect(sum).toBe(30);
    expect(created.every((t) => t.includes('EGG'))).toBe(true);
  });
});
