/**
 * The resource sheet's tier groups (Story 9.10, UX-DR8), in order. They show
 * only past `sheetBalance.groupAfterRows` rows, which first happens in Combat,
 * so naming the Colony is naming a phase the player has entered.
 */
export type ResourceTier = 'colony' | 'battle' | 'space';
export const TIER_ORDER: readonly ResourceTier[] = ['colony', 'battle', 'space'];
export const TIER_LABEL: Readonly<Record<ResourceTier, string>> = { colony: 'COLONY', battle: 'BATTLE DROPS', space: 'SPACE' };
