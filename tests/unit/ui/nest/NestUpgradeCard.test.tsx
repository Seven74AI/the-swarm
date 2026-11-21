import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/preact';
import '@preact/signals';
import { gameState } from '../../../../src/state/gameSignal';
import { Phase } from '../../../../src/phases/phases';
import { getUpgradeCost } from '../../../../src/systems/ResourceSystem';
import { NEST_UPGRADE_IDS, upgradeBalance } from '../../../../src/data/balance/upgrades';
import { NestUpgradeCard, NestUpgradeCards } from '../../../../src/ui/nest/NestUpgradeCard';
import { testActions } from '../../helpers/actions';
import { makeState } from '../../helpers/makeState';

/**
 * Story 4.6: each egg-chamber upgrade is a NEST card in Phase 1, shown like
 * Click Power's (once first affordable, or once a level is owned), in the
 * colony voice. Invariants only.
 */

const initial = gameState.value;
const card = (c: ParentNode, id: string) => c.querySelector<HTMLElement>(`[data-card="${id}"]`);

describe('NestUpgradeCard (Story 4.6)', () => {
  afterEach(() => {
    cleanup();
    gameState.value = initial;
  });

  for (const id of NEST_UPGRADE_IDS) {
    const cost = (level = 0) => getUpgradeCost(id, level)!;

    it(`${id}: absent until first affordable, then stays`, () => {
      gameState.value = makeState({ phase: Phase.EGG_LAYING, resources: { food: cost() - 1 } });
      const { container } = render(<NestUpgradeCard id={id} buy={() => ({ ok: true })} />);
      expect(card(container, id)).toBeNull();
      act(() => {
        gameState.value = { ...gameState.value, resources: { ...gameState.value.resources, food: cost() } };
      });
      expect(card(container, id)).not.toBeNull();
      act(() => {
        gameState.value = { ...gameState.value, resources: { ...gameState.value.resources, food: 0 } };
      });
      expect(card(container, id)).not.toBeNull();
    });

    it(`${id}: speaks in the colony voice: upper case, no exclamation mark`, () => {
      gameState.value = makeState({ phase: Phase.EGG_LAYING, resources: { food: cost() } });
      const { container } = render(<NestUpgradeCard id={id} buy={() => ({ ok: true })} />);
      const text = card(container, id)!.querySelector('.card__name')!.textContent! + card(container, id)!.querySelector('.card__effect')!.textContent!;
      expect(text).toBe(text.toUpperCase());
      expect(text).not.toContain('!');
    });

    it(`${id}: BUY buys a level through the action`, () => {
      gameState.value = makeState({ phase: Phase.EGG_LAYING, resources: { food: cost() } });
      const actions = testActions();
      const { container } = render(<NestUpgradeCard id={id} buy={() => actions.buyUpgrade(id)} />);
      const btn = card(container, id)!.querySelector<HTMLButtonElement>(`[data-action="buy-upgrade"][data-upgrade="${id}"]`)!;
      act(() => btn.click());
      expect(gameState.value.upgrades[id]).toBe(1);
      expect(gameState.value.resources.food).toBeLessThan(cost());
    });

    it(`${id}: at its last level the BUY is disabled`, () => {
      gameState.value = makeState({ phase: Phase.EGG_LAYING, resources: { food: 1e9 }, upgrades: { [id]: upgradeBalance[id].maxLevel! } });
      const { container } = render(<NestUpgradeCard id={id} buy={() => ({ ok: true })} />);
      const btn = card(container, id)!.querySelector<HTMLButtonElement>('[data-action="buy-upgrade"]')!;
      expect(btn.getAttribute('aria-disabled')).toBe('true');
    });

    it(`${id}: not on NEST after Phase 1`, () => {
      gameState.value = makeState({ phase: Phase.COLONY, resources: { food: 1e9 }, upgrades: { [id]: 1 } });
      const { container } = render(<NestUpgradeCard id={id} buy={() => ({ ok: true })} />);
      expect(card(container, id)).toBeNull();
    });
  }

  it('NestUpgradeCards shows every one that is affordable, in order', () => {
    gameState.value = makeState({ phase: Phase.EGG_LAYING, resources: { food: 1e9 } });
    const { container } = render(<NestUpgradeCards buy={() => ({ ok: true })} />);
    const ids = [...container.querySelectorAll<HTMLElement>('[data-card]')].map((el) => el.dataset.card);
    expect(ids).toEqual([...NEST_UPGRADE_IDS]);
  });
});
