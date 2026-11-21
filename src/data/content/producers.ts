import { Phase } from '../../phases/phases';

/** The resources a building price can name (`BuildingSystem` cost keys). */
export type ProducedResource = 'food' | 'wood' | 'stone' | 'nectar' | 'chitin' | 'silk' | 'venom';

/**
 * The producer table (Story 3.5, FR7; Story 3.6 extends it to every cost):
 * the earliest phase in which something produces each resource. Food comes
 * from workers (unassigned ones forage it) from the start; wood, stone and
 * nectar from the Colony roles (Gather, Dig, Forage, Story 3.4); chitin, silk
 * and venom only as battle loot, from Combat. A cost may name a resource only
 * in this phase or later. `tests/unit/data/buildingUnlocks.test.ts` checks
 * each entry against the real producers.
 */
export const FIRST_PRODUCED_IN: Readonly<Record<ProducedResource, Phase>> = {
  food: Phase.EGG_LAYING,
  wood: Phase.COLONY,
  stone: Phase.COLONY,
  nectar: Phase.COLONY,
  chitin: Phase.COMBAT,
  silk: Phase.COMBAT,
  venom: Phase.COMBAT,
};
