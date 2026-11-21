import type { ActionResult } from '../../actions';
import {
  AUTOMATION_BUILDINGS,
  RESEARCHES,
  getAutoBuildCost,
  getBuildingEffect,
  type AutomationBuildingType,
  type ResearchType,
} from '../../state/queries';
import { selectAutoEggRate, selectAutoProduction, selectCanBuildAuto, selectCanResearch } from '../../state/selectors';
import { formatFull, formatRate } from '../../utils/format';
import { Button } from '../primitives/Button';
import { Card } from '../primitives/Card';
import { RESOURCES } from '../shell/resourceCatalog';
import { Abbr, Sep } from '../primitives/Deco';
import type { ComponentChildren } from 'preact';

/** The actions the automation section uses (a subset of `Actions`). */
export interface AutomationActions {
  setAutoProduction(enabled: boolean): ActionResult;
  researchAutomation(id: ResearchType): ActionResult;
  buildAutomation(id: AutomationBuildingType): ActionResult;
}

const labelOf = (key: string) => RESOURCES.find((r) => r.id === key)?.label ?? key.toUpperCase();
const nameOf = (key: string) => RESOURCES.find((r) => r.id === key)?.name ?? key;

/** `100 FOOD · 50 WRKR`: the non-zero parts of a cost, with the strip labels (read as full names, UX-DR40). */
function costLine(cost: object): ComponentChildren {
  return (Object.entries(cost) as [string, number | undefined][])
    .filter(([, v]) => (v ?? 0) > 0)
    .map(([k, v], i) => (
      <span key={k}>
        {i > 0 && <Sep />}
        {formatFull(v ?? 0)} <Abbr shown={labelOf(k)} full={nameOf(k)} />
      </span>
    ));
}

function researchEffect(id: ResearchType): string {
  const e = RESEARCHES[id].effect;
  const parts: string[] = [];
  if (e.autoEggRate) parts.push(`+${formatRate(e.autoEggRate)} EGGS/S`);
  if (e.hatchBonus) parts.push(`+${formatFull(e.hatchBonus)} % HATCH`);
  if (e.multiplier) parts.push(`×${e.multiplier} PRODUCTION`);
  return parts.join(' · ');
}

function buildingEffect(id: AutomationBuildingType, level: number): string {
  const e = getBuildingEffect(id, level);
  const parts: string[] = [];
  if (e.autoEggRate) parts.push(`+${formatRate(e.autoEggRate)} EGGS/S`);
  if (e.multiplier) parts.push(`×${e.multiplier.toFixed(1)} PRODUCTION`);
  if (e.efficiency) parts.push(`+${formatFull(e.efficiency * 100)} % EFFICIENCY`);
  return parts.join(' · ') || 'NOT BUILT';
}

function ResearchRow({ id, actions }: { id: ResearchType; actions: AutomationActions }) {
  const def = RESEARCHES[id];
  const done = selectAutoProduction.value.researches[id] === true;
  const affordable = selectCanResearch(id).value;
  const missing = def.prerequisites.find((p) => selectAutoProduction.value.researches[p] !== true);
  const reason = missing ? `needs ${RESEARCHES[missing].name.toUpperCase()}` : "can't afford";
  return (
    <div class={done ? 'research-row researched' : 'research-row'} data-research={id}>
      <Card
        id={id}
        title={def.name.toUpperCase()}
        effect={researchEffect(id)}
        cost={done ? undefined : costLine(def.cost)}
        affordable={done || affordable}
        action={
          done ? (
            <span class="research-done" data-researched="">
              RESEARCHED
            </span>
          ) : (
            <Button
              verb="RESEARCH"
              label={`Research ${def.name}`}
              disabled={affordable ? false : reason}
              onPress={() => actions.researchAutomation(id)}
            />
          )
        }
      />
    </div>
  );
}

function BuildingRow({ id, actions }: { id: AutomationBuildingType; actions: AutomationActions }) {
  const def = AUTOMATION_BUILDINGS[id];
  const level = selectAutoProduction.value.buildings[id] ?? 0;
  const affordable = selectCanBuildAuto(id).value;
  const maxed = level >= def.maxLevel;
  return (
    <div class="auto-building-row" data-building={id}>
      <Card
        id={id}
        title={def.name.toUpperCase()}
        level={maxed ? `LV.${level} MAX` : `LV.${level} → ${level + 1}`}
        effect={buildingEffect(id, level)}
        cost={maxed ? undefined : costLine(getAutoBuildCost(id, level + 1))}
        affordable={maxed || affordable}
        action={
          maxed ? (
            <span class="building-max">MAX</span>
          ) : (
            <Button
              verb="BUILD"
              label={`Build ${def.name} level ${level + 1}`}
              disabled={affordable ? false : "can't afford"}
              onPress={() => actions.buildAutomation(id)}
            />
          )
        }
      />
    </div>
  );
}

/**
 * WRKR's automation section (Story 1.23): replaces AutoProductionPanel, from
 * Transcendence (tabs.ts). The auto-production toggle, the current auto egg
 * rate, the automation research and the automation buildings as cards.
 * Keeps the legacy hooks: `#automation-panel`, `.auto-toggle-label`,
 * `.auto-toggle`, `.auto-rate`, `.research-row[data-research]` (`.researched`)
 * and `.auto-building-row[data-building]`.
 */
export function AutomationSection({ actions }: { actions: AutomationActions }) {
  const enabled = selectAutoProduction.value.enabled;
  return (
    <section id="automation-panel" class="automation-panel wrkr-automation" aria-label="Automation">
      <h2 class="panel-title">AUTOMATION</h2>
      <label class="auto-toggle-label">
        <input
          type="checkbox"
          class="auto-toggle"
          checked={enabled}
          onChange={(e) => actions.setAutoProduction((e.currentTarget as HTMLInputElement).checked)}
        />{' '}
        AUTO-LAY EGGS
      </label>
      <p class="auto-rate">
        AUTO RATE <strong>{formatRate(selectAutoEggRate.value)} EGGS/S</strong>
      </p>
      <div class="research-section">
        {(Object.keys(RESEARCHES) as ResearchType[]).map((id) => (
          <ResearchRow key={id} id={id} actions={actions} />
        ))}
      </div>
      <div class="building-section">
        {(Object.keys(AUTOMATION_BUILDINGS) as AutomationBuildingType[]).map((id) => (
          <BuildingRow key={id} id={id} actions={actions} />
        ))}
      </div>
    </section>
  );
}
