import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/preact';
import '@preact/signals';
import { Phase } from '../../../../src/phases/phases';
import { PhaseReveal, REVEAL_MS } from '../../../../src/ui/overlays/PhaseReveal';
import { REVEAL_LINES } from '../../../../src/data/content/phaseReveal';
import { PHASE_TITLES } from '../../../../src/ui/shell/GoalMeter';

/**
 * Story 1.20 (UX-DR27): the phase reveal is a full-screen dialog that blocks
 * input for at most REVEAL_MS, shows the phase name in `display`, types in one
 * line, then ends. It can be skipped (tap, Enter, Esc) only once seen.
 */

const q = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel);

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.body.replaceChildren();
});

function show(props: { skippable?: boolean; reducedMotion?: boolean; phase?: Phase } = {}) {
  const done = vi.fn();
  render(
    <PhaseReveal
      phase={props.phase ?? Phase.COLONY}
      skippable={props.skippable ?? false}
      reducedMotion={props.reducedMotion ?? false}
      done={done}
    />,
  );
  return done;
}

describe('PhaseReveal', () => {
  it('is a modal dialog named by the phase, in display type, and takes focus', () => {
    show();
    const dialog = q('[data-overlay="phase-reveal"]')!;
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const name = document.getElementById(dialog.getAttribute('aria-labelledby')!)!;
    expect(name.textContent).toBe(PHASE_TITLES[Phase.COLONY].toUpperCase());
    expect(name.hasAttribute('data-display')).toBe(true);
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('types its one line in, then shows all of it', () => {
    show();
    const line = q('[data-reveal-line] [data-reveal-typed]')!;
    const full = REVEAL_LINES[Phase.COLONY];
    expect(line.textContent!.length).toBeLessThan(full.length);
    act(() => void vi.advanceTimersByTime(REVEAL_MS / 2));
    const mid = line.textContent!;
    expect(full.startsWith(mid)).toBe(true);
    act(() => void vi.advanceTimersByTime(REVEAL_MS / 2 - 1));
    expect(line.textContent).toBe(full);
  });

  it('shows the whole line at once under reduced motion', () => {
    show({ reducedMotion: true });
    expect(q('[data-reveal-line] [data-reveal-typed]')!.textContent).toBe(REVEAL_LINES[Phase.COLONY]);
  });

  it('ends by itself within the reveal time, once', () => {
    const done = show();
    act(() => void vi.advanceTimersByTime(REVEAL_MS - 1));
    expect(done).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1));
    expect(done).toHaveBeenCalledTimes(1);
    expect(REVEAL_MS).toBeLessThanOrEqual(3500);
  });

  it('cannot be skipped the first time, and swallows keys meant for the game', () => {
    const done = show({ skippable: false });
    const gameKey = vi.fn();
    document.addEventListener('keydown', gameKey);
    const dialog = q('[data-overlay="phase-reveal"]')!;
    fireEvent.pointerDown(dialog);
    fireEvent.click(dialog);
    for (const key of ['Enter', 'Escape', ' ']) fireEvent.keyDown(document.activeElement ?? document.body, { key });
    expect(done).not.toHaveBeenCalled();
    expect(gameKey).not.toHaveBeenCalled();
    expect(dialog.dataset.skippable).toBe('false');
    expect(q('[data-reveal-skip]')).toBeNull();
    document.removeEventListener('keydown', gameKey);
  });

  it.each([
    ['a tap', (el: HTMLElement) => fireEvent.pointerDown(el)],
    ['Enter', (el: HTMLElement) => fireEvent.keyDown(el, { key: 'Enter' })],
    ['Esc', (el: HTMLElement) => fireEvent.keyDown(el, { key: 'Escape' })],
  ])('once seen, %s skips it', (_name, act_) => {
    const done = show({ skippable: true });
    const dialog = q('[data-overlay="phase-reveal"]')!;
    expect(q('[data-reveal-skip]')).not.toBeNull();
    act_(dialog);
    expect(done).toHaveBeenCalledTimes(1);
    act(() => void vi.advanceTimersByTime(REVEAL_MS));
    expect(done).toHaveBeenCalledTimes(1);
  });
});
