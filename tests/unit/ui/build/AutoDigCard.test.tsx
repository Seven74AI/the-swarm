import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render } from '@testing-library/preact';
import '@preact/signals';
import { gameState } from '../../../../src/state/gameSignal';
import { Phase } from '../../../../src/phases/phases';
import { AutoDigCard } from '../../../../src/ui/build/AutoDigCard';
import { automationBalance } from '../../../../src/data/balance/automation';
import { getAutoDigCost } from '../../../../src/systems/Dig';
import { makeState } from '../../helpers/makeState';
import { testActions } from '../../helpers/actions';

/** Story 9.5 (FR58): the auto-dig card on BUILD. */
const initial = gameState.value;
const N = automationBalance.autoDig.unlockAfterRoomsByHand;
const colony = (roomsByHand: number, stone: number, auto = false) =>
  makeState({ phase: Phase.COLONY, resources: { stone, workers: 3 }, workersAssigned: { dig: 3 }, dig: { roomsDug: roomsByHand, progress: 0, carry: 0, roomsByHand, auto } });

describe('AutoDigCard', () => {
  afterEach(() => {
    cleanup();
    gameState.value = initial;
  });
  const card = (root: ParentNode) => root.querySelector<HTMLElement>('[data-auto-dig]');
  const buy = (root: ParentNode) => card(root)!.querySelector<HTMLButtonElement>('[data-action="buy-auto-dig"]')!;

  it('is absent until enough rooms were opened by hand', () => {
    gameState.value = colony(N - 1, 1_000_000);
    expect(card(render(<AutoDigCard buy={() => ({ ok: true })} />).container)).toBeNull();
  });

  it('shows its stone price and is disabled while unaffordable', () => {
    gameState.value = colony(N, 0);
    const { container } = render(<AutoDigCard buy={() => ({ ok: true })} />);
    expect(card(container)!.querySelector('.card__cost')!.textContent).not.toBe('');
    expect(buy(container).getAttribute('aria-disabled')).toBe('true');
  });

  it('BUY goes through the action; once bought the card reads BUILT', () => {
    gameState.value = colony(N, getAutoDigCost().stone);
    const actions = testActions();
    const { container } = render(<AutoDigCard buy={() => actions.buyAutoDig()} />);
    act(() => buy(container).click());
    expect(gameState.value.dig.auto).toBe(true);
    expect(card(container)!.textContent).toContain('BUILT');
    expect(buy(container).getAttribute('aria-disabled')).toBe('true');
  });
});
