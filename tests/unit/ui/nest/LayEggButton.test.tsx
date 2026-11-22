import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/preact';
import { signal } from '@preact/signals';
import { gameState } from '../../../../src/state/gameSignal';
import { createInitialState } from '../../../../src/state/GameState';
import { EventBus } from '../../../../src/engine/EventBus';
import { LayEggButton } from '../../../../src/ui/nest/LayEggButton';
import { HOLD_DELAY_MS, REPEAT_INTERVAL_MS } from '../../../../src/ui/primitives/holdRepeat';
import { testActions } from '../../helpers/actions';
import type { LayMode } from '../../../../src/platform/settings';
import { feelBalance } from '../../../../src/data/balance/feel';

/**
 * Story 1.22 (FR1, FR41): LAY EGG lays through the action, answers each tap
 * with a `+N` particle, repeats while held, and toggles in toggle lay mode.
 * The `#click-egg` hook is kept from the legacy ClickButton.
 */

const initial = gameState.value;

function setup(layMode: LayMode = 'hold', variant: 'primary' | 'secondary' = 'primary') {
  gameState.value = createInitialState();
  const bus = new EventBus();
  const actions = testActions(bus);
  const lay = vi.fn(() => actions.layEgg());
  const mode = signal<LayMode>(layMode);
  const view = render(<LayEggButton lay={lay} variant={variant} layMode={mode} />);
  const button = view.container.querySelector<HTMLButtonElement>('#click-egg');
  if (!button) throw new Error('no #click-egg');
  return { ...view, button, lay, bus };
}

function tap(el: HTMLElement): void {
  fireEvent.pointerDown(el, { pointerId: 1, button: 0 });
  fireEvent.pointerUp(el, { pointerId: 1, button: 0 });
}

describe('LayEggButton (Story 1.22)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    gameState.value = initial;
  });

  it('is the primary `> LAY EGG` action with the #click-egg hook', () => {
    const { button } = setup();
    expect(button.dataset.kind).toBe('primary');
    expect(button.textContent).toContain('LAY EGG');
    expect(button.querySelector('[data-prefix]')?.textContent).toBe('> ');
  });

  it('a tap lays eggs through the action and shows a +N particle', () => {
    const { button, lay, container, bus } = setup();
    const clicked = vi.fn();
    bus.subscribe('egg_clicked', clicked);
    const before = gameState.value.stats.totalEggsLaid;
    act(() => tap(button));
    expect(lay).toHaveBeenCalledTimes(1);
    expect(clicked).toHaveBeenCalledTimes(1);
    expect(gameState.value.stats.totalEggsLaid).toBeGreaterThan(before);
    const particle = container.querySelector('.click-particle');
    expect(particle?.textContent).toContain(`+${gameState.value.stats.totalEggsLaid - before}`);
  });

  it('particles go away after their animation time', () => {
    const { button, container } = setup();
    act(() => tap(button));
    expect(container.querySelectorAll('.click-particle').length).toBeGreaterThan(0);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(container.querySelectorAll('.click-particle')).toHaveLength(0);
  });

  it('holding repeats the lay', () => {
    const { button, lay } = setup();
    fireEvent.pointerDown(button, { pointerId: 1, button: 0 });
    act(() => {
      vi.advanceTimersByTime(HOLD_DELAY_MS + REPEAT_INTERVAL_MS * 3);
    });
    fireEvent.pointerUp(button, { pointerId: 1, button: 0 });
    expect(lay.mock.calls.length).toBeGreaterThan(1);
  });

  it('in toggle lay mode a tap starts laying at the repeat rate and the next tap stops it', () => {
    const { button, lay, container } = setup('toggle');
    act(() => tap(button));
    expect(container.querySelector('[data-laying="true"]')).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(REPEAT_INTERVAL_MS * 4);
    });
    const running = lay.mock.calls.length;
    expect(running).toBeGreaterThan(1);
    act(() => tap(button));
    expect(container.querySelector('[data-laying="true"]')).toBeNull();
    const stopped = lay.mock.calls.length;
    act(() => {
      vi.advanceTimersByTime(REPEAT_INTERVAL_MS * 4);
    });
    expect(lay.mock.calls.length).toBe(stopped);
  });

  it('toggle laying stops when the button goes away', () => {
    const { button, lay, unmount } = setup('toggle');
    act(() => tap(button));
    unmount();
    const after = lay.mock.calls.length;
    vi.advanceTimersByTime(REPEAT_INTERVAL_MS * 4);
    expect(lay.mock.calls.length).toBe(after);
  });

  it('the secondary variant (after Phase 1) holds to repeat and never toggles', () => {
    const { button, lay, container } = setup('toggle', 'secondary');
    expect(button.dataset.kind).toBe('secondary');
    act(() => tap(button));
    expect(container.querySelector('[data-laying="true"]')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(REPEAT_INTERVAL_MS * 4);
    });
    expect(lay).toHaveBeenCalledTimes(1);
  });

  it('marks the button when the nest is full', () => {
    const s = createInitialState();
    gameState.value = { ...s, resources: { ...s.resources, workers: s.resources.nestCapacity } };
    const { container } = render(<LayEggButton lay={() => ({ ok: true })} variant="primary" layMode={signal<LayMode>('hold')} />);
    expect(container.querySelector('#click-egg')!.classList.contains('click-button-at-capacity')).toBe(true);
  });
});

describe('LayEggButton game feel (Story 8.9)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    gameState.value = initial;
  });

  it('the +N types in next to EGG', () => {
    const { button, container } = setup();
    act(() => tap(button));
    const particle = container.querySelector('.click-particle')!;
    expect(particle.querySelector('[data-type-in]')?.textContent).toMatch(/^\+\d+$/);
    expect(particle.textContent).toMatch(/EGG$/);
  });

  it('a long hold floats +N at most floatMaxPerSec times in any second', () => {
    const { button, container } = setup();
    const created: number[] = [];
    const seen = new Set<Element>();
    fireEvent.pointerDown(button, { pointerId: 1, button: 0 });
    for (let t = 0; t < 3000; t += 10) {
      act(() => void vi.advanceTimersByTime(10));
      for (const el of container.querySelectorAll('.click-particle')) if (!seen.has(el)) (seen.add(el), created.push(t));
    }
    fireEvent.pointerUp(button, { pointerId: 1, button: 0 });
    expect(created.length).toBeGreaterThan(1);
    for (const t of created) expect(created.filter((u) => u >= t && u < t + 1000).length).toBeLessThanOrEqual(feelBalance.floatMaxPerSec);
  });

  it('is not marked for the buy press haptic: each lay already plays its own tick', () => {
    const { button } = setup();
    expect(button.getAttribute('data-feel')).not.toBe('press');
  });
});
