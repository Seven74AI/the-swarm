import { useRef } from 'preact/hooks';
import { Phase } from '../../phases/phases';
import { getUpgradeCost } from '../../state/queries';
import { selectPhase, selectResources, selectUpgrades } from '../../state/selectors';
import { NEST_UPGRADE_IDS, upgradeBalance, type UpgradeId } from '../../data/balance/upgrades';
import { UPGRADE_COPY } from '../../data/content/upgrades';
import { formatFull } from '../../utils/format';
import { Button } from '../primitives/Button';
import { Card } from '../primitives/Card';
import { RESOURCE_BY_ID } from '../shell/resourceCatalog';

type NestUpgradeId = (typeof NEST_UPGRADE_IDS)[number];
type Buy = (id: UpgradeId) => { readonly ok: boolean };

/**
 * An egg-chamber upgrade's card on NEST (Story 4.6), under Click Power's.
 * Phase 1 only, like Click Power's NEST card: it appears the first time the
 * upgrade is affordable (or once a level is owned) and stays for the
 * session. Copy comes from `data/content/upgrades.ts`, numbers from
 * `data/balance/upgrades.ts`.
 *
 * Hooks: `[data-card="<id>"]` (Card), its BUY button
 * `[data-action="buy-upgrade"][data-upgrade="<id>"]`.
 */
export function NestUpgradeCard({ id, buy }: { id: NestUpgradeId; buy: () => { readonly ok: boolean } }) {
  const seen = useRef(false);
  const level = selectUpgrades.value[id] ?? 0;
  const food = selectResources.value.food;
  const phase1 = selectPhase.value === Phase.EGG_LAYING;
  const def = upgradeBalance[id];
  const maxed = def.maxLevel !== undefined && level >= def.maxLevel;
  const cost = getUpgradeCost(id, level) ?? 0;
  const affordable = !maxed && food >= cost;
  if (affordable || level > 0) seen.current = true;
  if (!phase1 || !seen.current) return null;

  const copy = UPGRADE_COPY[id];
  const glyph = RESOURCE_BY_ID.food.glyph;
  return (
    <Card
      id={id}
      title={copy.title}
      level={maxed ? `LV.${level}` : `LV.${level} → ${level + 1}`}
      effect={copy.effect(def.perLevel)}
      cost={maxed ? 'ALL LEVELS BUILT' : `${formatFull(cost)} ${glyph} · you have ${formatFull(Math.floor(food))}`}
      affordable={affordable}
      shortfall={maxed ? undefined : { amount: cost - food, glyph }}
      action={
        <Button
          variant="secondary"
          verb="BUY"
          target={`${copy.title} LV.${level + 1}`}
          disabled={maxed ? 'ALL LEVELS BUILT' : affordable ? false : 'NOT ENOUGH FOOD'}
          onPress={buy}
          data-action="buy-upgrade"
          data-upgrade={id}
        />
      }
    />
  );
}

/** Every egg-chamber card, in `NEST_UPGRADE_IDS` order. */
export function NestUpgradeCards({ buy }: { buy: Buy }) {
  return (
    <>
      {NEST_UPGRADE_IDS.map((id) => (
        <NestUpgradeCard key={id} id={id} buy={() => buy(id)} />
      ))}
    </>
  );
}

/**
 * The heading over NEST's upgrade cards in Phase 1, for screen readers
 * (the cards' titles are h3s; the page has no h2 above them otherwise).
 */
export function NestUpgradesHeading() {
  if (selectPhase.value !== Phase.EGG_LAYING) return null;
  return <h2 class="visually-hidden">UPGRADES</h2>;
}
