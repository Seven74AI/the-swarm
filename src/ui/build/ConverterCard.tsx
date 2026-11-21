import {
  selectCanBuildParticleLab,
  selectConversionRate,
  selectConversionUnlocked,
  selectConversions,
  selectResearchStatus,
} from '../../state/selectors';
import { getConversionDefs, getParticleLabCost, itemKey, type ConversionDef } from '../../state/queries';
import { formatFull } from '../../utils/format';
import { Button } from '../primitives/Button';
import { Card } from '../primitives/Card';
import { CONVERSION_NOT_READY, CONVERTER_GLYPH, PARTICLE_LAB_GLYPH } from './buildCatalog';
import { PriceText, shortfallOf } from './cost';
import { highlightedKey } from './BuildingCards';
import { Arrow, decorate } from '../primitives/Deco';

function Step({ def }: { def: ConversionDef }) {
  const unlocked = selectConversionUnlocked(def.id).value;
  const researched = selectResearchStatus(def.requiredResearch).value === 'completed';
  const rate = selectConversionRate(def.id).value;
  const status = unlocked
    ? rate > 0
      ? `RUNNING · ${formatFull(Math.floor(rate))} PER SEC`
      : 'IDLE · INPUTS SHORT'
    : researched
      ? CONVERSION_NOT_READY[def.id]
      : 'NEEDS ITS RESEARCH';
  return (
    <li class="build-conversion" data-conversion={def.id} data-unlocked={unlocked ? 'true' : 'false'}>
      <span class="build-conversion__flow">
        <PriceText price={def.inputs} />
        <Arrow />
        <PriceText price={def.outputs} />
      </span>
      <span class="build-conversion__status" data-warn={unlocked ? undefined : ''}>
        {decorate(status)}
      </span>
    </li>
  );
}

/**
 * The resource converter as one BUILD card (Story 1.24), drawn into the
 * `#resource-converter-panel` host: each step of the conversion chain with
 * what goes in and out and why it isn't running, and `CONVERT` to run every
 * unlocked step once by hand. Hooks: `[data-conversion=<id>][data-unlocked]`,
 * `[data-action="run-conversions"]`.
 */
export function ConverterCard({ convert }: { convert: () => { readonly ok: boolean } }) {
  const defs = getConversionDefs();
  const lab = selectConversions.value?.particleLab ?? 0;
  const anyUnlocked = defs.some((d) => selectConversionUnlocked(d.id).value);
  return (
    <div class="build-item" data-converter="">
      <Card
        id="converter"
        glyph={CONVERTER_GLYPH}
        title="CONVERTER"
        level={lab > 0 ? `PARTICLE LAB LV.${lab}` : 'NO PARTICLE LAB'}
        effect="EACH STEP FEEDS THE NEXT, EVERY TICK"
        affordable={anyUnlocked}
        action={
          <Button
            variant="secondary"
            verb="CONVERT"
            target="ONCE"
            disabled={anyUnlocked ? false : 'RESEARCH A STEP FIRST'}
            onPress={convert}
            data-action="run-conversions"
          />
        }
      >
        <ul class="build-conversions">
          {defs.map((d) => (
            <Step key={d.id} def={d} />
          ))}
        </ul>
      </Card>
    </div>
  );
}

/**
 * The Particle Lab as a BUILD card (Story 3.6), above the converter in the
 * `#resource-converter-panel` host: the antimatter step runs once there is one,
 * and each level adds to its rate. Hooks: `[data-particle-lab]`,
 * `[data-action="build-particle-lab"]`.
 */
export function ParticleLabCard({ build }: { build: () => { readonly ok: boolean } }) {
  const level = selectConversions.value?.particleLab ?? 0;
  const affordable = selectCanBuildParticleLab.value;
  const price = getParticleLabCost(level);
  const target = level === 0 ? 'PARTICLE LAB' : `PARTICLE LAB LV.${level + 1}`;
  return (
    <div class="build-item" data-particle-lab="">
      <Card
        id="particle_lab"
        glyph={PARTICLE_LAB_GLYPH}
        title="PARTICLE LAB"
        level={`LV.${level} → ${level + 1}`}
        effect={level === 0 ? 'LETS VOID CRYSTALS BECOME ANTIMATTER' : 'MORE ANTIMATTER PER SEC'}
        cost={<PriceText price={price} />}
        affordable={affordable}
        shortfall={shortfallOf(price)}
        selected={highlightedKey() === itemKey({ kind: 'particle_lab' })}
        action={
          <Button
            variant="secondary"
            verb={level === 0 ? 'BUILD' : 'UPGRADE'}
            target={target}
            disabled={affordable ? false : 'NOT ENOUGH RESOURCES'}
            onPress={build}
            data-action="build-particle-lab"
          />
        }
      />
    </div>
  );
}
