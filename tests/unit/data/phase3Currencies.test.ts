import { describe, expect, it } from 'vitest';
import { itemKey, itemPanel, itemPrice, listItems } from '../../../src/systems/NextAction';
import { PANEL_PLACEMENT, isUnlocked } from '../../../src/data/content/tabs';
import { Phase } from '../../../src/phases/phases';
import { makeState } from '../helpers/makeState';

/**
 * Story 4.2 (FR9, FR10): what a Combat player buys with the battle drops is a
 * choice. Listing every purchase sold in Phase 3 by the currencies it costs,
 * each combat drop (silk, chitin, venom) has at least two purchases competing
 * for it.
 */

const COMBAT_DROPS = ['silk', 'chitin', 'venom'] as const;

describe('Phase 3 purchases by currency (Story 4.2)', () => {
  // A Combat colony at the start of the phase: first levels, nothing bought.
  const s = makeState({ phase: 'combat' });
  const sold = listItems().filter((ref) => isUnlocked(PANEL_PLACEMENT[itemPanel(ref)].unlockPhase, Phase.COMBAT));
  const byCurrency = new Map<string, string[]>();
  for (const ref of sold) {
    for (const [currency, amount] of Object.entries(itemPrice(s, ref))) {
      if ((amount ?? 0) > 0) byCurrency.set(currency, [...(byCurrency.get(currency) ?? []), itemKey(ref)]);
    }
  }

  it.each(COMBAT_DROPS)('%s has at least two purchases competing for it', (currency) => {
    expect(byCurrency.get(currency)?.length ?? 0, JSON.stringify(Object.fromEntries(byCurrency))).toBeGreaterThanOrEqual(2);
  });

  it('food is a Phase 3 currency too', () => {
    expect(byCurrency.get('food')?.length ?? 0).toBeGreaterThanOrEqual(1);
  });
});
