import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, act, fireEvent } from '@testing-library/preact';
import { signal } from '@preact/signals';
import { gameState } from '../../../../src/state/gameSignal';
import { Phase } from '../../../../src/phases/phases';
import { NestPrimary } from '../../../../src/ui/nest/NestPrimary';
import { getNextAction } from '../../../../src/systems/NextAction';
import { testActions } from '../../helpers/actions';
import { makeState } from '../../helpers/makeState';
import type { LayMode } from '../../../../src/platform/settings';

/**
 * Story 1.22: NEST's primary action is `> LAY EGG` in Phase 1; from Colony on
 * it is `> DIG` (Story 9.2), which replaced the next-action button there. After Phase 1 the scene area keeps a LAY EGG control
 * (NestSceneArea.test.tsx), so eggs never stop being producible.
 */

const initial = gameState.value;
const layMode = signal<LayMode>('hold');

function primary() {
  const actions = testActions();
  return render(<NestPrimary actions={actions} layMode={layMode} />);
}

describe('NestPrimary (Story 1.22)', () => {
  afterEach(() => {
    cleanup();
    gameState.value = initial;
  });

  it('is `> LAY EGG` in Phase 1, never the next-action button', () => {
    gameState.value = makeState({ phase: Phase.EGG_LAYING });
    const { container } = primary();
    expect(container.querySelector('#click-egg')).not.toBeNull();
    expect(container.querySelector('[data-next-action]')).toBeNull();
  });

  it('stays LAY EGG in Phase 1 when Click Power is affordable', () => {
    gameState.value = makeState({ phase: Phase.EGG_LAYING, resources: { food: 1_000_000 } });
    expect(getNextAction(gameState.value).kind).toBe('act');
    const { container } = primary();
    expect(container.querySelector('#click-egg')).not.toBeNull();
    expect(container.querySelector('[data-next-action]')).toBeNull();
  });

  it('is `> DIG` from Colony on, never the next-action button (Story 9.2)', () => {
    gameState.value = makeState({ phase: Phase.COLONY, resources: { food: 1_000_000, workers: 5 } });
    expect(getNextAction(gameState.value).kind).toBe('act');
    const { container } = primary();
    expect(container.querySelector('[data-nest-primary="dig"]')).not.toBeNull();
    expect(container.querySelector('#click-egg')).toBeNull();
    expect(container.querySelector('[data-next-action]')).toBeNull();
    const button = container.querySelector<HTMLButtonElement>('[data-nest-primary="dig"] button[data-action="dig"]');
    expect(button?.dataset.kind).toBe('primary');
    expect(button?.textContent).toContain('DIG');
  });

  it('a DIG press digs the current room through the action', () => {
    gameState.value = makeState({ phase: Phase.COMBAT });
    const before = gameState.value.dig;
    const { container } = primary();
    const button = container.querySelector<HTMLButtonElement>('button[data-action="dig"]')!;
    act(() => {
      fireEvent.pointerDown(button, { pointerId: 1, button: 0 });
      fireEvent.pointerUp(button, { pointerId: 1, button: 0 });
    });
    const after = gameState.value.dig;
    expect(after.progress + after.roomsDug).toBeGreaterThan(before.progress + before.roomsDug);
  });

  it('holding DIG repeats the press (UX-DR11)', () => {
    vi.useFakeTimers();
    try {
      gameState.value = makeState({ phase: Phase.COLONY });
      const { container } = primary();
      const button = container.querySelector<HTMLButtonElement>('button[data-action="dig"]')!;
      const points = () => gameState.value.dig.progress + gameState.value.dig.roomsDug;
      act(() => {
        fireEvent.pointerDown(button, { pointerId: 1, button: 0 });
      });
      act(() => {
        vi.advanceTimersByTime(2_000);
      });
      const held = points();
      act(() => {
        vi.advanceTimersByTime(1_000);
        fireEvent.pointerUp(button, { pointerId: 1, button: 0 });
      });
      expect(held).toBeGreaterThan(0);
      expect(points()).toBeGreaterThan(held);
    } finally {
      vi.useRealTimers();
    }
  });

  it('switches from LAY EGG to DIG when the phase commits', () => {
    gameState.value = makeState({ phase: Phase.EGG_LAYING });
    const { container } = primary();
    act(() => {
      gameState.value = { ...gameState.value, phase: Phase.COLONY };
    });
    expect(container.querySelector('#click-egg')).toBeNull();
    expect(container.querySelector('[data-nest-primary="dig"] button[data-action="dig"]')).not.toBeNull();
  });
});
