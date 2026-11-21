import { selectCombatResources, selectResources } from '../../state/selectors';
import { formatFull } from '../../utils/format';
import type { Shortfall } from '../primitives/Card';
import { RESOURCE_BY_ID, type ResourceId } from '../shell/resourceCatalog';

/** A price: resource id → amount (zero and unknown entries are skipped). */
export type Price = { readonly [resource: string]: number | undefined } | object;

/** The priced resources, in the order the price lists them. */
export function priceEntries(price: Price): [ResourceId, number][] {
  const out: [ResourceId, number][] = [];
  for (const [id, amount] of Object.entries(price) as [string, number | undefined][]) {
    if (amount === undefined || !(amount > 0) || !(id in RESOURCE_BY_ID)) continue;
    out.push([id as ResourceId, amount]);
  }
  return out;
}

/** The player's stock of a resource (a component reading it re-renders on that slice). */
export function stockOf(id: ResourceId): number {
  const def = RESOURCE_BY_ID[id];
  const store = def.store === 'combatResources' ? selectCombatResources.value : selectResources.value;
  return (store as unknown as Record<string, number>)[id] ?? 0;
}

/** The first resource short of the price, as the Card's shortfall (`needs 60 more △`), or null. */
export function shortfallOf(price: Price): Shortfall | null {
  for (const [id, need] of priceEntries(price)) {
    const short = Math.ceil(need - stockOf(id));
    if (short > 0) return { amount: short, glyph: RESOURCE_BY_ID[id].glyph };
  }
  return null;
}

/** `400 ◊ · 40 ▭`: whole amounts with inline glyphs. */
export function PriceText({ price, sign = '' }: { price: Price; sign?: string }) {
  const entries = priceEntries(price);
  return (
    <>
      {entries.map(([id, amount], i) => (
        <span key={id} data-price={id}>
          {i > 0 ? ' · ' : ''}
          {sign}
          {formatFull(Math.floor(amount))} <span aria-label={RESOURCE_BY_ID[id].name}>{RESOURCE_BY_ID[id].glyph}</span>
        </span>
      ))}
    </>
  );
}
