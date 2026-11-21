import { useRef } from 'preact/hooks';
import { Phase } from '../../phases/phases';
import { eggsPerTap, getUpgradeCost } from '../../state/queries';
import { selectBuildAction, selectPhase, selectResources, selectUpgrades } from '../../state/selectors';
import { formatFull } from '../../utils/format';
import { Button } from '../primitives/Button';
import { Card } from '../primitives/Card';
import { RESOURCE_BY_ID } from '../shell/resourceCatalog';

const UPGRADE = 'click_power';

/**
 * The Click Power card on NEST (Story 1.22; EXPERIENCE.md → Click Power
 * card). Phase 1 only: it appears under the event lines the first time Click
 * Power is affordable (or when a level is already owned) and stays for the
 * session, even when the food drops again. Buying it never changes the
 * primary action, which stays `> LAY EGG`. From Phase 2 the upgrade is sold
 * in BUILD, so NEST stops showing it.
 *
 * With `place="build"` it is BUILD's card instead (Story 1.24, UX-DR18):
 * shown from Phase 2 whether or not it is affordable, and highlighted when it
 * is BUILD's pick (`selectBuildAction`), so BUILD's `> BUY` buys it.
 *
 * Hook: `[data-card="click_power"]` (Card), its BUY button `[data-action="buy-click-power"]`.
 */
export function ClickPowerCard({ buy, place = 'nest' }: { buy: () => { readonly ok: boolean }; place?: 'nest' | 'build' }) {
  const seen = useRef(false);
  const phase1 = selectPhase.value === Phase.EGG_LAYING;
  const level = selectUpgrades.value[UPGRADE] ?? 0;
  const food = selectResources.value.food;
  const cost = getUpgradeCost(UPGRADE, level) ?? 0;
  const affordable = food >= cost;
  if (affordable || level > 0) seen.current = true;
  const pick = selectBuildAction.value;
  const shown = place === 'nest' ? phase1 && seen.current : !phase1;
  if (!shown) return null;

  const glyph = RESOURCE_BY_ID.food.glyph;
  const gain = eggsPerTap(level + 1) - eggsPerTap(level);
  return (
    <Card
      id={UPGRADE}
      title="CLICK POWER"
      level={`LV.${level} → ${level + 1}`}
      effect={`+${formatFull(gain)} EGG PER TAP`}
      cost={`${formatFull(cost)} ${glyph} · you have ${formatFull(Math.floor(food))}`}
      affordable={affordable}
      selected={place === 'build' && pick.kind === 'act' && pick.key === `upgrade:${UPGRADE}`}
      shortfall={{ amount: cost - food, glyph }}
      action={
        <Button
          variant="secondary"
          verb="BUY"
          target={`CLICK POWER LV.${level + 1}`}
          repeat
          disabled={affordable ? false : 'NOT ENOUGH FOOD'}
          onPress={buy}
          data-action="buy-click-power"
        />
      }
    />
  );
}
