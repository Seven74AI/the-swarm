import { describe, it, expect, beforeEach } from 'vitest';
import { gameState } from '../../../src/state/gameSignal';
import { createInitialState, type GameState } from '../../../src/state/GameState';
import {
  selectCanPurchasePrestigeUpgrade,
  selectOfflineAwayLimitMs,
  selectOfflineEfficiency,
  selectLegacyUnlocked,
  selectPrestigeAvailable,
  selectPrestigeRequirementCurrent,
  selectPrestigeRequirementMet,
  selectProjectedLegacyPoints,
} from '../../../src/state/selectors';
import {
  calculateLegacyPoints,
  canPurchasePrestigeUpgrade,
  getPhaseScore,
  getUnmetRequirements,
  isLegacyRevealed,
  isPrestigeAvailable,
  PRESTIGE_REQUIREMENTS,
} from '../../../src/state/queries';
import { PRESTIGE_UPGRADES } from '../../../src/data/prestigeTree';
import { getOfflineCapMs, getOfflineEfficiency } from '../../../src/systems/OfflineProgression';
import { PHASE_ORDER } from '../../../src/phases/phases';

/** Story 1.36: LOG → LEGACY reads the prestige rules through selectors, like every other view. */
const ready = (): GameState => {
  const s = createInitialState();
  return {
    ...s,
    buildings: { ...s.buildings, barracks: { level: 5, count: 0 }, walls: { level: 5 }, warehouse: { level: 5 } },
    prestige: { ...s.prestige, totalFoodProduced: 1_000_000_000, totalWoodProduced: 50_000, totalStoneProduced: 50_000, totalNectarProduced: 25_000 },
  };
};

describe('prestige selectors', () => {
  beforeEach(() => {
    gameState.value = createInitialState();
  });

  it('follow the prestige rules for a fresh state and a ready one', () => {
    for (const s of [createInitialState(), ready()]) {
      gameState.value = s;
      expect(selectPrestigeAvailable.value).toBe(isPrestigeAvailable(s));
      expect(selectLegacyUnlocked.value).toBe(isLegacyRevealed(s));
      const unmet = new Set(getUnmetRequirements(s).map((u) => u.id));
      for (const r of PRESTIGE_REQUIREMENTS) {
        expect(selectPrestigeRequirementMet(r.id).value, r.id).toBe(!unmet.has(r.id));
        expect(selectPrestigeRequirementCurrent(r.id).value, r.id).toBe(r.current(s));
      }
      expect(selectOfflineEfficiency.value).toBe(getOfflineEfficiency(s));
      expect(selectOfflineAwayLimitMs.value).toBe(getOfflineCapMs(s));
    }
    const id = PRESTIGE_REQUIREMENTS[0].id;
    expect(selectPrestigeRequirementMet(id)).toBe(selectPrestigeRequirementMet(id));
  });

  it('project the same legacy points prestige() awards, in every phase (#188)', () => {
    for (const phase of PHASE_ORDER) {
      const s = { ...ready(), phase };
      gameState.value = s;
      expect(selectProjectedLegacyPoints.value).toBe(calculateLegacyPoints(s.prestige.totalFoodProduced, getPhaseScore(phase)));
    }
  });

  it('say which tree upgrades can be bought', () => {
    const s = { ...createInitialState(), prestige: { ...createInitialState().prestige, legacyPoints: 1000 } };
    gameState.value = s;
    for (const u of PRESTIGE_UPGRADES) {
      expect(selectCanPurchasePrestigeUpgrade(u.id).value).toBe(canPurchasePrestigeUpgrade(s, u.id));
    }
    expect(selectCanPurchasePrestigeUpgrade(PRESTIGE_UPGRADES[0].id)).toBe(selectCanPurchasePrestigeUpgrade(PRESTIGE_UPGRADES[0].id));
  });
});
