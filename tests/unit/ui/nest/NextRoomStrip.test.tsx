import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/preact';
// The component re-renders through the Preact signals integration (main loads it).
import '@preact/signals';
import { gameState } from '../../../../src/state/gameSignal';
import { Phase } from '../../../../src/phases/phases';
import { NextRoomStrip } from '../../../../src/ui/nest/NextRoomStrip';
import { nextRoom } from '../../../../src/systems/Dig';
import { digBalance } from '../../../../src/data/balance/dig';
import { sceneBalance } from '../../../../src/data/balance/scene';
import { makeState } from '../../helpers/makeState';

/** Story 9.3 (FR56, UX-DR47): the NEXT ROOM strip under the nest scene. */
const initial = gameState.value;
const colony = (dig: number, progress = 0) =>
  makeState({ phase: Phase.COLONY, resources: { workers: Math.max(dig, 1) }, workersAssigned: { dig }, dig: { roomsDug: 1, progress, carry: 0 } });

describe('NextRoomStrip', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    gameState.value = initial;
  });

  it('is absent in Egg Laying', () => {
    gameState.value = makeState({ phase: Phase.EGG_LAYING });
    const { container } = render(<NextRoomStrip />);
    expect(container.querySelector('[data-next-room]')).toBeNull();
  });

  it('reads NEXT ROOM, the room size, a meter, the time left and the presses left', () => {
    gameState.value = colony(4, 100);
    const r = nextRoom(gameState.value);
    const { container } = render(<NextRoomStrip />);
    const strip = container.querySelector('[data-next-room]')!;
    expect(strip.textContent).toContain('NEXT ROOM');
    expect(strip.textContent).toContain(`+${digBalance.roomSize}`);
    expect(strip.querySelector('[data-next-room-time]')!.textContent).toMatch(/^IN /);
    expect(strip.textContent).toContain(`${r.presses} DIGS`);
    const meter = strip.querySelector('[role="progressbar"]')!;
    expect(meter.getAttribute('aria-valuetext')).toBeTruthy();
    expect(meter.getAttribute('aria-valuenow')).toBe(String(r.percent));
  });

  it('reads NEXT ROOM · AUTO-DIG ON once auto-dig is bought (Story 9.5)', () => {
    gameState.value = { ...colony(4, 100), dig: { roomsDug: 1, progress: 100, carry: 0, roomsByHand: 3, auto: true } };
    const { container } = render(<NextRoomStrip />);
    expect(container.querySelector('[data-next-room]')!.getAttribute('data-auto-dig')).toBe('on');
    expect(container.querySelector('.next-room__label')!.textContent).toMatch(/^NEXT ROOM\s*·.*AUTO-DIG ON$/);
    expect(container.querySelector('[data-next-room-time]')!.textContent).toMatch(/^IN /);
  });

  it('reads NO DIGGERS in place of the time when nobody digs', () => {
    gameState.value = colony(0);
    const { container } = render(<NextRoomStrip />);
    expect(container.querySelector('[data-next-room-time]')!.textContent).toBe('NO DIGGERS');
  });

  it('refreshes at most once per period', () => {
    vi.useFakeTimers();
    gameState.value = colony(4, 0);
    const { container } = render(<NextRoomStrip />);
    const presses = () => container.querySelector('[data-next-room-digs]')!.textContent;
    const first = presses();
    act(() => {
      gameState.value = colony(4, 1000);
    });
    const afterFirst = presses();
    act(() => {
      gameState.value = colony(4, 3000);
    });
    // Within the period the strip holds what it last showed.
    expect(presses()).toBe(afterFirst);
    act(() => {
      vi.advanceTimersByTime(sceneBalance.viewRefreshMs);
    });
    expect(presses()).not.toBe(first);
    expect(presses()).toContain(`${nextRoom(colony(4, 3000)).presses}`);
    expect(1000 / sceneBalance.viewRefreshMs).toBeLessThanOrEqual(4);
  });
});
