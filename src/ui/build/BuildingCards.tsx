import { selectBuildAction, selectBuildingOpen, selectBuildingUnlocked, selectBuildings, selectCanBuild } from '../../state/selectors';
import { getBuildCost, getEffects, itemKey, type BuildingType } from '../../state/queries';
import { formatFull } from '../../utils/format';
import { Button } from '../primitives/Button';
import { Card } from '../primitives/Card';
import { BUILDING_CARDS, type BuildingCardDef } from './buildCatalog';
import { BUILDING_MAX_LEVEL } from '../../data/content/buildings';
import { PriceText, shortfallOf } from './cost';
import './build.css';

/** The key of BUILD's highlighted card, or null when nothing is affordable (Story 1.24). */
export function highlightedKey(): string | null {
  const pick = selectBuildAction.value;
  return pick.kind === 'act' ? pick.key : null;
}

const pct = (x: number | undefined): number => Math.floor((x ?? 0) * 100);
const whole = (x: number | undefined): string => formatFull(Math.floor(x ?? 0));

/** The effect line: what the next level changes, `now → next`. */
function effectLine(id: BuildingType, level: number): string {
  const now = getEffects(id, level);
  const next = getEffects(id, level + 1);
  switch (id) {
    case 'barracks':
      return `SCOUTS ${whole(now.scoutsCap)} → ${whole(next.scoutsCap)} · WARRIORS ${whole(now.warriorsCap)} → ${whole(next.warriorsCap)}`;
    case 'walls':
      return `DEFENSE +${pct(now.defenseBonus)}% → +${pct(next.defenseBonus)}%`;
    case 'warehouse':
      return `NEST CAPACITY +${whole(now.nestCapacity)} → +${whole(next.nestCapacity)}`;
    case 'fungus_garden':
      return `GATHERER FOOD +${pct(now.gatherFoodBonus)}% → +${pct(next.gatherFoodBonus)}%`;
    case 'tunnels':
      return `DIGGING SPEED +${pct(now.digSpeedBonus)}% → +${pct(next.digSpeedBonus)}%`;
    case 'silk_weaving':
      return level >= 1 ? 'ARMOR UPGRADES UNLOCKED' : 'UNLOCKS ARMOR UPGRADES';
    case 'chitin_armory':
      return level >= 1 ? 'WEAPON UPGRADES UNLOCKED' : 'UNLOCKS WEAPON UPGRADES';
    case 'venom_lab':
      return `POISON LV.${whole(now.venomLabLevel)} → ${whole(next.venomLabLevel)} · USES VENOM IN BATTLE`;
    case 'midden':
      return `CHITIN PER FALLEN SOLDIER ${whole(now.salvagePerFallen)} → ${whole(next.salvagePerFallen)}`;
  }
}

type Buy = (id: BuildingType) => { readonly ok: boolean };

function BuildingCard({ def, selected, buy }: { def: BuildingCardDef; selected: boolean; buy: Buy }) {
  const level = selectBuildings.value[def.id].level;
  const affordable = selectCanBuild(def.id).value;
  // A level whose price names a resource nothing makes yet waits (Story 3.5).
  const open = selectBuildingOpen(def.id).value;
  const price = getBuildCost(def.id, level + 1);
  // A workshop stops at the level that opens its equipment (Story 4.8).
  const maxed = level >= (BUILDING_MAX_LEVEL[def.id] ?? Infinity);
  return (
    <div class="build-item" data-building={def.id}>
      <Card
        id={def.id}
        glyph={<def.glyph />}
        title={def.name}
        level={maxed ? `LV.${level} · MAX` : `LV.${level} → ${level + 1}`}
        effect={effectLine(def.id, level)}
        cost={maxed ? 'BUILT' : <PriceText price={price} />}
        affordable={affordable}
        shortfall={maxed ? undefined : shortfallOf(price)}
        selected={selected}
        action={
          <Button
            variant="secondary"
            verb="BUY"
            target={`${def.name} LV.${level + 1}`}
            repeat
            gain={{ unit: 'LV' }}
            disabled={affordable ? false : maxed ? 'BUILT' : open ? 'NOT ENOUGH RESOURCES' : 'NOT YET'}
            onPress={() => buy(def.id)}
            data-action="buy-building"
          />
        }
      />
    </div>
  );
}

/**
 * BUILD's building cards (Story 1.24, UX-DR17), drawn into the `#building-panel` host:
 * only the buildings open in this phase (Story 3.5, `data/content/buildings.ts`).
 * Hooks kept from the legacy BuildingPanel: `[data-building=<id>]`; each holds a Card
 * (`[data-card=<id>]`) and its BUY button (`[data-action="buy-building"]`).
 */
export function BuildingCards({ buy }: { buy: Buy }) {
  const selected = highlightedKey();
  return (
    <>
      {BUILDING_CARDS.filter((def) => selectBuildingUnlocked(def.id).value).map((def) => (
        <BuildingCard key={def.id} def={def} selected={selected === itemKey({ kind: 'building', id: def.id })} buy={buy} />
      ))}
    </>
  );
}
