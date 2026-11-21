import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/preact';
import { signal } from '@preact/signals';
import { gameState } from '../../../../src/state/gameSignal';
import { Phase } from '../../../../src/phases/phases';
import { NestPrimary } from '../../../../src/ui/nest/NestPrimary';
import { NestScene } from '../../../../src/ui/nest/NestScene';
import { getNextAction } from '../../../../src/systems/NextAction';
import { testActions } from '../../helpers/actions';
import { makeState } from '../../helpers/makeState';
import type { LayMode } from '../../../../src/platform/settings';

/**
 * Story 1.22: NEST's primary action is `> LAY EGG` in Phase 1 and follows
 * `getNextAction` after it, with `NEXT AFFORDABLE: …` when nothing is
 * suggested. After Phase 1 the scene area keeps a LAY EGG control (the queen,
 * until Story 8.5 draws her), so eggs never stop being producible.
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

  it('follows getNextAction after Phase 1', () => {
    gameState.value = makeState({ phase: Phase.COLONY, resources: { food: 1_000_000, workers: 5 } });
    const next = getNextAction(gameState.value);
    expect(next.kind).toBe('act');
    const { container } = primary();
    expect(container.querySelector('#click-egg')).toBeNull();
    expect(container.querySelector<HTMLElement>('[data-next-action]')?.dataset.nextKey).toBe(next.key);
  });

  it('shows NEXT AFFORDABLE when no action exists', () => {
    gameState.value = makeState({ phase: Phase.COLONY, resources: { food: 0, workers: 5 }, workersAssigned: { gather: 5 } });
    const next = getNextAction(gameState.value);
    expect(next.kind).toBe('none');
    const { container } = primary();
    const zone = container.querySelector('[data-next-action="none"]');
    expect(zone).not.toBeNull();
    if (next.kind === 'none' && next.nextAffordable) expect(zone!.textContent).toMatch(/^NEXT AFFORDABLE: .+ IN ~/);
  });

  it('switches from LAY EGG to the next action when the phase commits', () => {
    gameState.value = makeState({ phase: Phase.EGG_LAYING });
    const { container } = primary();
    act(() => {
      gameState.value = { ...gameState.value, phase: Phase.COLONY };
    });
    expect(container.querySelector('#click-egg')).toBeNull();
    expect(container.querySelector('[data-next-action]')).not.toBeNull();
  });
});

describe('NestScene placeholder (Story 1.22)', () => {
  afterEach(() => {
    cleanup();
    gameState.value = initial;
  });

  it('is a placeholder scene area, with no lay control in Phase 1', () => {
    gameState.value = makeState({ phase: Phase.EGG_LAYING });
    const { container } = render(<NestScene lay={() => ({ ok: true })} />);
    expect(container.querySelector('[data-nest-scene]')).not.toBeNull();
    expect(container.querySelector('#click-egg')).toBeNull();
  });

  it('holds a secondary LAY EGG after Phase 1, so eggs stay producible', () => {
    gameState.value = makeState({ phase: Phase.COLONY });
    const actions = testActions();
    const { container } = render(<NestScene lay={() => actions.layEgg()} />);
    const btn = container.querySelector<HTMLButtonElement>('[data-nest-scene] #click-egg');
    expect(btn).not.toBeNull();
    expect(btn!.dataset.kind).toBe('secondary');
    const before = gameState.value.stats.totalEggsLaid;
    act(() => btn!.click());
    expect(gameState.value.stats.totalEggsLaid).toBeGreaterThan(before);
  });
});
