import type { ReadonlySignal } from '@preact/signals';
import type { ResearchProjectId } from '../../state/GameState';
import {
  selectAssignedResearchers,
  selectCanStartResearch,
  selectResearch,
  selectResearchStatus,
} from '../../state/selectors';
import { getProjects, itemKey, type ResearchProjectDef } from '../../state/queries';
import { formatFull, formatTime } from '../../utils/format';
import { Button } from '../primitives/Button';
import { Card } from '../primitives/Card';
import { HoldToConfirm, type ConfirmSettings } from '../primitives/HoldToConfirm';
import { Meter } from '../primitives/Meter';
import { highlightedKey } from './BuildingCards';
import { RESEARCH_EFFECT, RESEARCH_GLYPH } from './buildCatalog';
import { PriceText, shortfallOf, type Price } from './cost';
import { decorate } from '../primitives/Deco';

type Act = (id: ResearchProjectId) => { readonly ok: boolean };

export interface ResearchCardsProps {
  start: Act;
  cancel: Act;
  /** Confirm style and hold duration (platform settings, from main). */
  confirmSettings: ReadonlySignal<ConfirmSettings>;
}

/** What cancelling gives back: half of each price entry, floored (ResearchSystem.cancelProject). */
function refundOf(price: Price): Price {
  const out: Record<string, number> = {};
  for (const [id, amount] of Object.entries(price) as [string, number | undefined][]) {
    const half = Math.floor((amount ?? 0) / 2);
    if (half > 0) out[id] = half;
  }
  return out;
}

function ResearchCard({ def, step, steps, selected, props }: { def: ResearchProjectDef; step: number; steps: number; selected: boolean; props: ResearchCardsProps }) {
  const status = selectResearchStatus(def.id).value;
  const canStart = selectCanStartResearch(def.id).value;
  const researchers = selectAssignedResearchers.value;
  const lifecycle = selectResearch.value.projects[def.id];
  const short = shortfallOf(def.cost);
  const staffed = researchers >= def.requiredResearchers;
  const crew = `${formatFull(def.requiredResearchers)} RESEARCHERS`;

  let action;
  let progress = null;
  if (status === 'completed') {
    action = <span class="build-done" data-research-done="">DONE</span>;
  } else if (status === 'in_progress' && lifecycle?.status === 'running') {
    const left = Math.max(0, lifecycle.durationMs - lifecycle.progressMs);
    const pct = lifecycle.durationMs > 0 ? Math.floor((lifecycle.progressMs / lifecycle.durationMs) * 100) : 0;
    progress = (
      <div class="build-progress">
        <Meter label="Research progress" value={lifecycle.progressMs} max={lifecycle.durationMs} valueText={`${def.name} ${pct} %`} />
        <p class="build-progress__left" data-time-left="" data-stalled={staffed ? undefined : ''}>
          {staffed ? `${formatTime(left).toUpperCase()} LEFT` : decorate(`PAUSED · NEEDS ${crew}`)}
        </p>
      </div>
    );
    // Irreversible (half the price is lost): hold or two taps, with the refund shown first (UX-DR19).
    action = (
      <HoldToConfirm
        verb="CANCEL"
        target="(50 % BACK)"
        cost={
          <span data-refund="">
            <PriceText price={refundOf(def.cost)} sign="+" /> BACK
          </span>
        }
        settings={props.confirmSettings}
        onConfirm={() => props.cancel(def.id)}
        data-action="cancel-research"
      />
    );
  } else {
    const reason =
      status === 'locked'
        ? `NEEDS ${(getProjects().find((p) => p.id === def.prerequisite)?.name ?? '').toUpperCase()}`
        : !staffed
          ? `NEEDS ${crew} · HAVE ${formatFull(researchers)}`
          : canStart
            ? false
            : 'NOT ENOUGH RESOURCES';
    action = (
      <Button
        variant="secondary"
        verb="START"
        target={def.name.toUpperCase()}
        disabled={reason}
        onPress={() => props.start(def.id)}
        data-action="start-research"
      />
    );
  }

  return (
    <div class="build-item" data-research-project={def.id} data-research-status={status}>
      <Card
        id={def.id}
        glyph={RESEARCH_GLYPH}
        title={def.name.toUpperCase()}
        level={`STEP ${step}/${steps}`}
        effect={RESEARCH_EFFECT[def.id]}
        cost={
          status === 'completed' ? undefined : (
            <>
              <PriceText price={def.cost} /> · {crew}
            </>
          )
        }
        affordable={status === 'completed' || status === 'in_progress' || canStart}
        shortfall={status === 'available' ? short : null}
        selected={selected}
        action={action}
      >
        {progress}
      </Card>
    </div>
  );
}

/**
 * BUILD's research chain (Story 1.24, UX-DR19), drawn into the `#research-panel` host:
 * `> START` runs one step with a meter and the time left; while it runs, `CANCEL (50 % BACK)`
 * needs HoldToConfirm and shows the refund first. Hooks kept from the legacy ResearchPanel:
 * `[data-research-project=<id>]` (now with `data-research-status`) and
 * `[data-action="cancel-research"]`; START is `[data-action="start-research"]`.
 * Researchers are assigned on WRKR.
 */
export function ResearchCards(props: ResearchCardsProps) {
  const selected = highlightedKey();
  const projects = getProjects();
  return (
    <>
      {projects.map((def, i) => (
        <ResearchCard
          key={def.id}
          def={def}
          step={i + 1}
          steps={projects.length}
          selected={selected === itemKey({ kind: 'research', id: def.id })}
          props={props}
        />
      ))}
    </>
  );
}
