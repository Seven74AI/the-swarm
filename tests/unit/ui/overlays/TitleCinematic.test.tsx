import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/preact';
import { signal } from '@preact/signals';
import '@preact/signals';
import { TitleCinematic, bindTitleCinematic } from '../../../../src/ui/overlays/TitleCinematic';
import { TITLE_BEATS, TITLE_COPY } from '../../../../src/data/content/titleCinematic';
import { createOverlayController } from '../../../../src/ui/shell/OverlayController';
import { OverlayHost } from '../../../../src/ui/shell/OverlayHost';
import { createIntroFlag } from '../../../../src/platform/storage/introFlag';

/**
 * Story 8.10 (UX-DR28): the title cinematic on first launch. It plays once
 * (the flag is set when it starts), is skipped by a tap, Enter, Space or Esc,
 * ends on a real wake button, then `A QUEEN, ALONE.`, then the game.
 * Reduced motion opens it on its title frame. Replay plays it on request.
 */

const q = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel);
const overlay = () => q('[data-overlay="title-cinematic"]');
const stage = () => overlay()?.getAttribute('data-stage');

function memoryFlag() {
  const data = new Map<string, string>();
  return createIntroFlag({
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  });
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.body.replaceChildren();
  delete document.documentElement.dataset.overlayActive;
});

function show(props: { reducedMotion?: boolean } = {}) {
  const done = vi.fn();
  render(<TitleCinematic reducedMotion={props.reducedMotion ?? false} done={done} />);
  return done;
}

describe('TitleCinematic', () => {
  it('is a full-screen modal dialog in Phase 1 amber, a CRT scene surface with vector line-work, and takes focus', () => {
    show();
    const dialog = overlay()!;
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label') ?? document.getElementById(dialog.getAttribute('aria-labelledby') ?? '')?.textContent).toBeTruthy();
    // Phase 1 palette only, whatever phase the game is in (a replay from a later phase).
    expect(dialog.dataset.palette).toBe('egg');
    expect(dialog.hasAttribute('data-crt-surface')).toBe(true);
    expect(dialog.querySelector('svg[data-line-work]')).not.toBeNull();
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(stage()).toBe('playing');
  });

  it('tells its story in order, ONE EGG. then ONE QUEEN., and reaches its title frame by itself in about 11 s', () => {
    const done = show();
    const lineAt = (ms: number) => {
      act(() => void vi.advanceTimersByTime(ms));
      return q('[data-title-line]')?.textContent ?? '';
    };
    expect(q('[data-title-line]')?.textContent ?? '').not.toContain(TITLE_COPY.egg);
    expect(lineAt(TITLE_BEATS.eggMs)).toBe(TITLE_COPY.egg);
    expect(lineAt(TITLE_BEATS.queenMs - TITLE_BEATS.eggMs)).toBe(TITLE_COPY.queen);
    act(() => void vi.advanceTimersByTime(TITLE_BEATS.titleMs - TITLE_BEATS.queenMs));
    expect(stage()).toBe('title');
    expect(overlay()!.textContent).toContain(TITLE_COPY.tagline);
    expect(TITLE_COPY.tagline).toBe('ONE EGG. ONE QUEEN. ONE SWARM.');
    // About 11 s, and it waits on the button: it never ends by itself.
    expect(TITLE_BEATS.titleMs).toBeGreaterThanOrEqual(9000);
    expect(TITLE_BEATS.titleMs).toBeLessThanOrEqual(13000);
    act(() => void vi.advanceTimersByTime(60_000));
    expect(done).not.toHaveBeenCalled();
  });

  it.each([
    ['a tap', () => fireEvent.pointerDown(overlay()!)],
    ['Enter', () => fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Enter' })],
    ['Space', () => fireEvent.keyDown(document.activeElement ?? document.body, { key: ' ' })],
    ['Esc', () => fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })],
    ['the skip button', () => fireEvent.click(q('[data-title-skip]')!)],
  ])('%s skips to the title frame', (_, skip) => {
    const done = show();
    act(() => void skip());
    expect(stage()).toBe('title');
    expect(done).not.toHaveBeenCalled();
  });

  it('the skip is a real, named button while it plays', () => {
    show();
    const skip = q<HTMLButtonElement>('[data-title-skip]')!;
    expect(skip.tagName).toBe('BUTTON');
    expect(skip.textContent).toContain(TITLE_COPY.skip);
  });

  it('ends on a real, focused [ TAP TO WAKE THE QUEEN ] button; waking shows A QUEEN, ALONE., then ends', () => {
    const done = show({ reducedMotion: false });
    fireEvent.keyDown(document.body, { key: 'Escape' });
    const wake = q<HTMLButtonElement>('[data-action="wake-queen"]')!;
    expect(wake.tagName).toBe('BUTTON');
    expect(wake.textContent).toBe(`[ ${TITLE_COPY.wake} ]`);
    expect(document.activeElement).toBe(wake);
    // The brackets are decoration: the name is the words.
    expect(wake.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
    act(() => void fireEvent.click(wake));
    expect(stage()).toBe('alone');
    expect(q('[data-title-alone]')!.textContent).toBe(TITLE_COPY.alone);
    expect(done).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(TITLE_BEATS.aloneMs));
    expect(done).toHaveBeenCalledTimes(1);
  });

  it.each(['Enter', ' ', 'Escape'])('on the title frame, %j wakes the queen', (key) => {
    show({ reducedMotion: true });
    act(() => void fireEvent.keyDown(document.body, { key }));
    expect(stage()).toBe('alone');
  });

  it('swallows every key meant for the game', () => {
    show();
    const gameKey = vi.fn();
    document.addEventListener('keydown', gameKey);
    for (const key of ['a', 'Enter', ' ', 'Escape', 'p', '1']) fireEvent.keyDown(document.activeElement ?? document.body, { key });
    expect(gameKey).not.toHaveBeenCalled();
    document.removeEventListener('keydown', gameKey);
  });

  it('opens on its title frame under reduced motion', () => {
    show({ reducedMotion: true });
    expect(stage()).toBe('title');
    expect(q('[data-action="wake-queen"]')).not.toBeNull();
    expect(overlay()!.textContent).toContain(TITLE_COPY.tagline);
  });

  it('names no later phase and draws in the phase aliases only (currentColor)', () => {
    show({ reducedMotion: true });
    const html = overlay()!.outerHTML;
    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(html).not.toMatch(/rgb\(|hsl\(/i);
  });
});

describe('bindTitleCinematic', () => {
  function setup(opts: { hasSave?: boolean; seen?: boolean; reducedMotion?: boolean } = {}) {
    const overlays = createOverlayController(document.documentElement);
    render(<OverlayHost overlays={overlays} />);
    const flag = memoryFlag();
    if (opts.seen) flag.markDone();
    const onWoken = vi.fn();
    let cinematic!: ReturnType<typeof bindTitleCinematic>;
    act(() => {
      cinematic = bindTitleCinematic({
        overlays,
        flag,
        hasSave: opts.hasSave ?? false,
        reducedMotion: signal(opts.reducedMotion ?? false),
        onWoken,
      });
    });
    return { overlays, flag, onWoken, cinematic };
  }

  it('plays on first launch (no save, no flag), and sets the flag as it starts', () => {
    const { flag, overlays } = setup();
    expect(overlays.active.value?.kind).toBe('title-cinematic');
    expect(overlays.held.value).toBe(true);
    // Set already: backgrounding or closing mid-cinematic never replays it.
    expect(flag.done()).toBe(true);
    expect(overlay()).not.toBeNull();
  });

  it('does not play with a save, or once seen', () => {
    for (const opts of [{ hasSave: true }, { seen: true }, { hasSave: true, seen: true }]) {
      const { overlays } = setup(opts);
      expect(overlays.active.value).toBeNull();
      cleanup();
    }
  });

  it('once the queen wakes, the overlay ends and the game takes over (the coach mark is next)', () => {
    const { overlays, onWoken } = setup({ reducedMotion: true });
    act(() => void fireEvent.click(q('[data-action="wake-queen"]')!));
    expect(onWoken).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(TITLE_BEATS.aloneMs));
    expect(overlays.active.value).toBeNull();
    expect(overlay()).toBeNull();
    expect(onWoken).toHaveBeenCalledTimes(1);
  });

  it('replay plays it again even with a save and the flag set, and leaves the flag alone', () => {
    const { overlays, flag, cinematic } = setup({ hasSave: true, seen: true });
    expect(overlays.active.value).toBeNull();
    const markDone = vi.spyOn(flag, 'markDone');
    const reset = vi.spyOn(flag, 'reset');
    act(() => void cinematic.replay());
    expect(overlays.active.value?.kind).toBe('title-cinematic');
    expect(stage()).toBe('playing');
    expect(markDone).not.toHaveBeenCalled();
    expect(reset).not.toHaveBeenCalled();
  });
});
