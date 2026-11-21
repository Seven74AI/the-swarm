import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/preact';
import '@preact/signals';
import { gameState } from '../../../../src/state/gameSignal';
import { Phase } from '../../../../src/phases/phases';
import { getUpgradeCost } from '../../../../src/systems/ResourceSystem';
import { ClickPowerCard } from '../../../../src/ui/nest/ClickPowerCard';
import { testActions } from '../../helpers/actions';
import { makeState } from '../../helpers/makeState';

/**
 * Story 1.22 (EXPERIENCE.md → Click Power card): in Phase 1 the card appears
 * under the event lines once Click Power is first affordable, and stays.
 * From Phase 2 it lives in BUILD, so NEST no longer shows it.
 */

const initial = gameState.value;
const cost = (level = 0) => getUpgradeCost('click_power', level)!;

function setFood(food: number): void {
  gameState.value = { ...gameState.value, resources: { ...gameState.value.resources, food } };
}

function card(container: ParentNode): HTMLElement | null {
  return container.querySelector('[data-card="click_power"]');
}

describe('ClickPowerCard (Story 1.22)', () => {
  afterEach(() => {
    cleanup();
    gameState.value = initial;
  });

  it('is absent until Click Power is first affordable', () => {
    gameState.value = makeState({ phase: Phase.EGG_LAYING, resources: { food: cost() - 1 } });
    const { container } = render(<ClickPowerCard buy={() => ({ ok: true })} />);
    expect(card(container)).toBeNull();
  });

  it('appears once affordable and stays when the food drops again', () => {
    gameState.value = makeState({ phase: Phase.EGG_LAYING, resources: { food: cost() - 1 } });
    const { container } = render(<ClickPowerCard buy={() => ({ ok: true })} />);
    act(() => setFood(cost()));
    expect(card(container)).not.toBeNull();
    act(() => setFood(0));
    expect(card(container)).not.toBeNull();
  });

  it('shows from the start once a level is owned', () => {
    gameState.value = makeState({ phase: Phase.EGG_LAYING, upgrades: { click_power: 1 } });
    const { container } = render(<ClickPowerCard buy={() => ({ ok: true })} />);
    expect(card(container)).not.toBeNull();
  });

  it('BUY buys a level through the action', () => {
    gameState.value = makeState({ phase: Phase.EGG_LAYING, resources: { food: cost() } });
    const actions = testActions();
    const { container } = render(<ClickPowerCard buy={() => actions.buyUpgrade('click_power')} />);
    const btn = card(container)!.querySelector<HTMLButtonElement>('button')!;
    act(() => btn.click());
    expect(gameState.value.upgrades.click_power ?? 0).toBeGreaterThan(0);
    expect(gameState.value.resources.food).toBeLessThan(cost());
  });

  it('is not on NEST after Phase 1', () => {
    gameState.value = makeState({ phase: Phase.COLONY, resources: { food: cost() * 10 } });
    const { container } = render(<ClickPowerCard buy={() => ({ ok: true })} />);
    expect(card(container)).toBeNull();
  });
});
