import { Phase } from '../../phases/phases';

/** Every resource a price can name: building, research, mutation, equipment, ship, Legacy and Particle Lab costs. */
export type ProducedResource =
  | 'food'
  | 'workers'
  | 'wood'
  | 'stone'
  | 'nectar'
  | 'chitin'
  | 'silk'
  | 'venom'
  | 'voidCrystals'
  | 'antimatter'
  | 'darkMatter'
  | 'legacyPoints';

/**
 * The producer table (Story 3.5, FR7; Story 3.6, FR37): the earliest phase in
 * which something produces each resource. A cost may name a resource only in
 * this phase or later (the catch-22 rule).
 *
 * - Food comes from workers (unassigned ones forage it) and workers from the
 *   eggs the queen lays, from the start.
 * - Wood, stone and nectar come from the Colony roles (Gather, Dig, Forage, Story 3.4).
 * - Chitin, silk and venom come only as battle loot, from Combat.
 * - Void crystals, antimatter and dark matter first come as the 10 % space
 *   drops of an expedition, from Expansion: the bootstrap that pays the
 *   first scout ship and the first research before the converter runs.
 * - Legacy points come from prestige, which needs building levels that cost
 *   combat loot, so from Combat at the earliest.
 *
 * `tests/unit/data/noCatch22.test.ts` checks every cost against this table
 * and each entry against the real producers.
 */
export const FIRST_PRODUCED_IN: Readonly<Record<ProducedResource, Phase>> = {
  food: Phase.EGG_LAYING,
  workers: Phase.EGG_LAYING,
  wood: Phase.COLONY,
  stone: Phase.COLONY,
  nectar: Phase.COLONY,
  chitin: Phase.COMBAT,
  silk: Phase.COMBAT,
  venom: Phase.COMBAT,
  voidCrystals: Phase.EXPANSION,
  antimatter: Phase.EXPANSION,
  darkMatter: Phase.EXPANSION,
  legacyPoints: Phase.COMBAT,
};
