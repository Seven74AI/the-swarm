import { selectAutoDigOn, selectAutoDigOpen, selectCanBuyAutoDig } from '../../state/selectors';
import { getAutoDigCost, itemKey } from '../../state/queries';
import { Button } from '../primitives/Button';
import { Card } from '../primitives/Card';
import { AUTO_DIG_GLYPH } from './buildCatalog';
import { PriceText, shortfallOf } from './cost';
import { highlightedKey } from './BuildingCards';

/**
 * Auto-dig (Story 9.5, FR58) on BUILD: on sale once enough rooms were opened
 * by hand, paid in stone. Bought, the diggers press DIG on their own and the
 * card reads BUILT. Hooks: `[data-auto-dig]`, `[data-action="buy-auto-dig"]`.
 */
export function AutoDigCard({ buy }: { buy: () => { readonly ok: boolean } }) {
  const on = selectAutoDigOn.value;
  const open = selectAutoDigOpen.value;
  const affordable = selectCanBuyAutoDig.value;
  if (!on && !open) return null;
  const price = getAutoDigCost();
  return (
    <div class="build-item" data-auto-dig={on ? 'on' : ''}>
      <Card
        id="autodig"
        glyph={<AUTO_DIG_GLYPH />}
        title="AUTO-DIG"
        effect="THE DIGGERS DIG ON THEIR OWN"
        cost={on ? 'BUILT' : <PriceText price={price} />}
        affordable={!on && affordable}
        shortfall={on ? undefined : shortfallOf(price)}
        selected={!on && highlightedKey() === itemKey({ kind: 'autodig' })}
        action={
          <Button
            variant="secondary"
            verb="BUY"
            target="AUTO-DIG"
            disabled={on ? 'BUILT' : affordable ? false : 'NOT ENOUGH RESOURCES'}
            onPress={buy}
            data-action="buy-auto-dig"
          />
        }
      />
    </div>
  );
}
