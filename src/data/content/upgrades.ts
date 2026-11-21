import type { UpgradeEffects, UpgradeId } from '../balance/upgrades';

/**
 * Card copy for the food upgrades (Story 4.6, UX-DR42: upper case, present
 * tense, no exclamation marks, nothing from a later phase). `effect` gets
 * one level's effects from `data/balance/upgrades.ts`, so no number is
 * restated here.
 */
export interface UpgradeCopy {
  readonly title: string;
  readonly effect: (perLevel: UpgradeEffects) => string;
}

export const UPGRADE_COPY: Readonly<Record<UpgradeId, UpgradeCopy>> = {
  click_power: { title: 'CLICK POWER', effect: (e) => `+${e.eggsPerTap ?? 0} EGG PER TAP` },
  warm_brood: { title: 'WARM BROOD', effect: (e) => `EGGS HATCH ${e.hatchPercent ?? 0}% FASTER` },
  lean_rations: { title: 'LEAN RATIONS', effect: (e) => `WORKERS EAT ${e.upkeepCutPercent ?? 0}% LESS` },
  side_chamber: { title: 'SIDE CHAMBER', effect: (e) => `+${e.nestCapacity ?? 0} NEST ROOM` },
};
