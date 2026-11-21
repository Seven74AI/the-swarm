import { selectConversionRate, selectConversionUnlocked, selectConversions, selectResearchStatus } from '../../state/selectors';
import { getConversionDefs, type ConversionDef } from '../../state/queries';
import { formatFull } from '../../utils/format';
import { Button } from '../primitives/Button';
import { Card } from '../primitives/Card';
import { CONVERSION_NOT_READY, CONVERTER_GLYPH } from './buildCatalog';
import { PriceText } from './cost';

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
        <PriceText price={def.inputs} /> → <PriceText price={def.outputs} />
      </span>
      <span class="build-conversion__status" data-warn={unlocked ? undefined : ''}>
        {status}
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
