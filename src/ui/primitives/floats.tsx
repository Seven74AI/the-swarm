import { useEffect, useRef, useState } from 'preact/hooks';
import { feelBalance } from '../../data/balance/feel';
import { formatInt } from '../../utils/format';
import { TypeIn } from './TypeIn';
import './floats.css';

/**
 * Floating `+N` (Story 8.9, UX-DR37; EXPERIENCE.md → Game Feel & Juice): at
 * most `feelBalance.floatMaxPerSec` in any `floatWindowMs`, however fast a
 * held button repeats. What arrives faster is held back and added to the next
 * `+N`, so the floats still add up to what was gained.
 */

export interface FloatGate {
  /** Offer an amount: the amount to float now (with anything held back), or null while over the limit. */
  offer(amount: number): number | null;
  /** When a held-back amount may float, or null with nothing held back. */
  nextAt(): number | null;
  /** Take what is held back (0 if nothing). */
  drain(): number;
}

export function createFloatGate(now: () => number = () => Date.now()): FloatGate {
  let times: number[] = [];
  let pending = 0;
  const prune = (t: number) => {
    // A closed window: a float exactly one window after another still counts with it.
    times = times.filter((at) => at >= t - feelBalance.floatWindowMs);
  };
  return {
    offer(amount) {
      const t = now();
      prune(t);
      pending += Math.max(0, Math.floor(amount));
      if (times.length >= feelBalance.floatMaxPerSec || pending === 0) return null;
      times = [...times, t];
      const out = pending;
      pending = 0;
      return out;
    },
    nextAt() {
      if (pending === 0) return null;
      const t = now();
      prune(t);
      return times.length < feelBalance.floatMaxPerSec ? t : times[0] + feelBalance.floatWindowMs + 1;
    },
    drain() {
      const out = pending;
      pending = 0;
      return out;
    },
  };
}

export interface FloatItem {
  readonly id: number;
  readonly amount: number;
}

export interface Floats {
  readonly list: readonly FloatItem[];
  /** A gain of `amount` (whole units): floats now, or with the next `+N` the limit allows. */
  spawn(amount: number): void;
}

/** At most this many `+N` on screen at once, so nothing piles up. */
const MAX_SHOWN = 6;

export function useFloats(): Floats {
  const [list, setList] = useState<readonly FloatItem[]>([]);
  const gate = useRef<FloatGate | null>(null);
  gate.current ??= createFloatGate();
  const nextId = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      for (const t of timers.current) clearTimeout(t);
      timers.current.clear();
      if (flushTimer.current) clearTimeout(flushTimer.current);
    },
    [],
  );

  const later = (fn: () => void, ms: number) => {
    const t = setTimeout(() => {
      timers.current.delete(t);
      fn();
    }, ms);
    timers.current.add(t);
  };

  const show = (amount: number) => {
    const id = nextId.current++;
    setList((l) => [...l, { id, amount }].slice(-MAX_SHOWN));
    later(() => setList((l) => l.filter((f) => f.id !== id)), feelBalance.floatLifeMs);
  };

  const scheduleFlush = () => {
    const g = gate.current!;
    const at = g.nextAt();
    if (at === null || flushTimer.current) return;
    flushTimer.current = setTimeout(() => {
      flushTimer.current = null;
      const n = g.offer(0);
      if (n !== null) show(n);
      scheduleFlush();
    }, Math.max(0, at - Date.now()));
  };

  return {
    list,
    spawn(amount) {
      const n = gate.current!.offer(amount);
      if (n !== null) show(n);
      else scheduleFlush();
    },
  };
}

/**
 * The `+N UNIT` floats. The `+N` types in; the unit stays put. Decoration only
 * (`aria-hidden`): the number it gained is in the strip or on the card.
 */
/** `className` replaces the default `float-gain` look (LAY EGG keeps its `click-particle`). */
export function Floats({ floats, unit, className }: { floats: readonly FloatItem[]; unit: string; className?: string }) {
  return (
    <>
      {floats.map((f) => (
        <span key={f.id} class={className ?? 'float-gain'} data-float="" aria-hidden="true">
          <TypeIn text={`+${formatInt(f.amount)}`} />
          {` ${unit}`}
        </span>
      ))}
    </>
  );
}
