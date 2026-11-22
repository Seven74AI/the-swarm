import { Fragment } from 'preact';
import type { SheetController } from '../shell/SheetController';
import { PeekSheet } from '../shell/Sheet';
import { Sep } from '../primitives/Deco';
import { selectFreeWorkers, selectNestView, selectPhase, selectWorkersAssigned } from '../../state/selectors';
import { Phase } from '../../phases/phases';
import { rolesForPhase, type RoleId } from '../../data/content/roles';
import { formatFull } from '../../utils/format';
import type { ChamberId } from '../scenes/nestLayout';
import '../scenes/scenes.css';

/**
 * A chamber's peek sheet (Story 8.5, UX-DR34): opened from a chamber of the
 * nest scene, it shows that chamber's exact counts, from the selectors. A
 * peek sheet has no scrim and leaves NEST usable (ADR 0011).
 *
 * BROOD: the queen, eggs and larvae. WORKERS: the workers, and after Phase 1
 * how many are on each role and how many are free.
 *
 * Hooks: `[data-chamber-peek="brood|workers"]`, `[data-chamber-count="<what>"]`.
 */

function Count({ what, n }: { what: string; n: number }) {
  return <span data-chamber-count={what}>{formatFull(n)}</span>;
}

function BroodCounts() {
  const v = selectNestView.value;
  return (
    <p class="chamber-peek__line">
      <Count what="queen" n={1} /> QUEEN
      <Sep />
      <Count what="eggs" n={v.eggs} /> EGGS
      <Sep />
      <Count what="larvae" n={v.larvae} /> LARVAE
    </p>
  );
}

function WorkerCounts() {
  const v = selectNestView.value;
  const phase = selectPhase.value as Phase;
  const assigned = selectWorkersAssigned.value;
  const onRole = (id: RoleId): number => (id === 'research' ? assigned.researchers : (assigned[id] ?? 0));
  const roles = phase === Phase.EGG_LAYING ? [] : rolesForPhase(phase);
  return (
    <>
      <p class="chamber-peek__line">
        <Count what="workers" n={v.workers} /> WORKERS
      </p>
      {roles.length > 0 && (
        <p class="chamber-peek__line">
          {roles.map((r) => (
            <Fragment key={r.id}>
              {r.label} <Count what={r.id} n={onRole(r.id)} />
              <Sep />
            </Fragment>
          ))}
          FREE <Count what="free" n={selectFreeWorkers.value} />
        </p>
      )}
    </>
  );
}

export function ChamberPeekSheet({ chamber }: { chamber: ChamberId }) {
  return (
    <PeekSheet header={chamber === 'brood' ? 'BROOD CHAMBER' : 'WORKER CHAMBER'} data-chamber-peek={chamber}>
      {chamber === 'brood' ? <BroodCounts /> : <WorkerCounts />}
    </PeekSheet>
  );
}

/** Open a chamber's peek sheet (a newer peek replaces it); returns its sheet id. */
export function openChamberPeek(sheets: SheetController, chamber: ChamberId): number {
  return sheets.open({ priority: 'peek', render: () => <ChamberPeekSheet chamber={chamber} /> });
}
