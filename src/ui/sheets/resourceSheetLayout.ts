import { sheetBalance } from '../../data/balance/sheet';
import { RESOURCE_BY_ID } from '../shell/resourceCatalog';
import { TIER_LABEL, TIER_ORDER, type ResourceTier } from '../../data/content/resourceTiers';
import type { ResourceRow } from '../shell/resourceFeed';

/** A falling or capped resource: the sheet puts it first, and opens its group (Story 9.10). */
export const needsALook = (r: ResourceRow): boolean => r.capped || r.ratePerSec < 0;

export interface SheetGroup {
  /** `COLONY`, `BATTLE DROPS`, `SPACE`; null for the one plain list. */
  readonly label: string | null;
  readonly tier: ResourceTier | null;
  readonly rows: readonly ResourceRow[];
  /** Shown open: the plain list always; a group only when it holds a falling or capped resource. */
  readonly open: boolean;
}

/** Falling or capped first, then the rest, each in catalog (phase) order. */
function ordered(rows: readonly ResourceRow[]): ResourceRow[] {
  return [...rows.filter(needsALook), ...rows.filter((r) => !needsALook(r))];
}

/**
 * The resource sheet's rows (Story 9.10, UX-DR8): one list while there are
 * at most `sheetBalance.groupAfterRows`; past that, one group per tier, each
 * collapsed unless it holds a falling or capped resource. Pure.
 */
export function sheetLayout(rows: readonly ResourceRow[]): { readonly groups: readonly SheetGroup[] } {
  if (rows.length <= sheetBalance.groupAfterRows) return { groups: [{ label: null, tier: null, rows: ordered(rows), open: true }] };
  const groups = TIER_ORDER.map((tier): SheetGroup => {
    const inTier = rows.filter((r) => RESOURCE_BY_ID[r.id].tier === tier);
    return { label: TIER_LABEL[tier], tier, rows: ordered(inTier), open: inTier.some(needsALook) };
  }).filter((g) => g.rows.length > 0);
  return { groups };
}
