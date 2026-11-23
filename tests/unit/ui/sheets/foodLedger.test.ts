import { afterEach, describe, expect, it } from 'vitest';
import { foodSpentSince, resetFoodLedger, withFoodLedger } from '../../../../src/ui/sheets/foodLedger';
import { testActions } from '../../helpers/actions';
import { gameState } from '../../../../src/state/gameSignal';
import { makeState } from '../../helpers/makeState';
import { Phase } from '../../../../src/phases/phases';

/** Story 9.12: SPENT THIS HOUR lists the one-off food spends of the session's last hour. */
const initial = gameState.value;
afterEach(() => {
  gameState.value = initial;
  resetFoodLedger();
});

const HOUR = 3_600_000;

describe('the food ledger', () => {
  it('records an accepted action that spends food, by what it bought, adding up repeats', () => {
    let now = 1_000_000;
    const actions = withFoodLedger(testActions(), () => gameState.value.resources.food, () => now);
    gameState.value = makeState({ phase: Phase.EGG_LAYING, resources: { food: 1_000_000 } });
    const before = gameState.value.resources.food;
    expect(actions.buyUpgrade('click_power').ok).toBe(true);
    now += 1_000;
    expect(actions.buyUpgrade('click_power').ok).toBe(true);
    const spent = foodSpentSince(now - HOUR);
    expect(spent).toEqual([{ label: 'CLICK POWER', amount: before - gameState.value.resources.food }]);
  });

  it('a refused action or one that spends no food records nothing', () => {
    const actions = withFoodLedger(testActions(), () => gameState.value.resources.food, () => 5);
    gameState.value = makeState({ phase: Phase.EGG_LAYING, resources: { food: 0 } });
    expect(actions.buyUpgrade('click_power').ok).toBe(false);
    actions.layEgg();
    expect(foodSpentSince(0)).toEqual([]);
  });

  it('a suggestion performed through perform is named by its intent', () => {
    const actions = withFoodLedger(testActions(), () => gameState.value.resources.food, () => 5);
    gameState.value = makeState({ phase: Phase.EGG_LAYING, resources: { food: 1_000_000 } });
    expect(actions.perform({ action: 'buyUpgrade', id: 'click_power' }).ok).toBe(true);
    expect(foodSpentSince(0).map((s) => s.label)).toEqual(['CLICK POWER']);
  });

  it('forgets what is older than the window', () => {
    let now = 0;
    const actions = withFoodLedger(testActions(), () => gameState.value.resources.food, () => now);
    gameState.value = makeState({ phase: Phase.EGG_LAYING, resources: { food: 1_000_000 } });
    actions.buyUpgrade('click_power');
    now = 2 * HOUR;
    expect(foodSpentSince(now - HOUR)).toEqual([]);
  });
});
