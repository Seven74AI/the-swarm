import { useEffect, useRef, useState } from 'preact/hooks';
import type { ActionResult } from '../../actions';
import { ROLES, rolesForPhase, type RoleDef, type RoleId } from '../../data/content/roles';
import { nextActionBalance } from '../../data/balance/nextAction';
import {
  selectAssignedTotal,
  selectBuildings,
  selectEffectiveNestCapacity,
  selectFoodProductionPerSec,
  selectFoodUpkeepPerSec,
  selectFreeWorkers,
  selectNestCapacity,
  selectPhase,
  selectReallocation,
  selectWorkers,
  selectWorkersAssigned,
  selectWorkforceTotal,
  type MoveSource,
  type Reallocation,
} from '../../state/selectors';
import type { Phase } from '../../phases/phases';
import { formatDelta, formatFull } from '../../utils/format';
import { Button } from '../../primitives/Button';
import { MultiplierRow, Stepper, type Multiplier } from '../../primitives/Stepper';
import { lockedTarget, type TargetLock } from '../../shell/targetLock';
import { roleBar } from './roleBar';
import './wrkr.css';

/** The actions WRKR uses (a subset of `Actions`). */
export interface WorkersActions {
  stepRole(role: RoleId, delta: number): ActionResult;
  moveWorkers(from: MoveSource, to: RoleId, count: number): ActionResult;
}

const NO_FREE = 'no free workers';
/** Kept from the legacy WorkerAssignment panel (nest-capacity-ui.spec reads it). */
const DIG_TOOLTIP = 'Each Dig worker adds +1 capacity per second.';

const plural = (n: number, one: string) => (n === 1 ? `one ${one}` : `${n} ${one}s`);

/** `UPKEEP n / PRODUCTION n` and the net; a negative net in `warn` with ▼ (DESIGN.md → Upkeep readout). */
function UpkeepReadout() {
  const upkeep = selectFoodUpkeepPerSec.value;
  const production = selectFoodProductionPerSec.value;
  const net = production - upkeep;
  const trend = net < 0 ? 'down' : net > 0 ? 'up' : 'flat';
  return (
    <p class="wrkr-upkeep" data-upkeep="">
      UPKEEP <span data-upkeep-value="">{formatFull(upkeep)}</span> / PRODUCTION{' '}
      <span data-production-value="">{formatFull(production)}</span>{' '}
      <span class="wrkr-upkeep__net worker-summary-value" data-net="" data-trend={trend}>
        {trend === 'down' ? '▼ ' : ''}NET {formatDelta(net)}/S
      </span>
    </p>
  );
}

/** `ASSIGNED a / total · FREE f`: Research counts toward the assigned total. */
function AssignedLine() {
  return (
    <p class="wrkr-line" data-assigned="">
      ASSIGNED {formatFull(selectAssignedTotal.value)} / {formatFull(selectWorkforceTotal.value)} ·{' '}
      <span data-free="">FREE {formatFull(selectFreeWorkers.value)}</span>
    </p>
  );
}

/** Workers against the nest capacity, with the Warehouse's share. Keeps the legacy `.capacity-line`. */
function CapacityLine() {
  void selectBuildings.value;
  const cap = selectEffectiveNestCapacity.value;
  const bonus = cap - selectNestCapacity.value;
  return (
    <p class="wrkr-line capacity-line" data-capacity="">
      NEST {formatFull(selectWorkers.value)} / {formatFull(cap)}
      {bonus > 0 ? ` (+${formatFull(bonus)} WAREHOUSE)` : ''}
    </p>
  );
}

function RoleRow({ role, multiplier, actions }: { role: RoleDef; multiplier: Multiplier; actions: WorkersActions }) {
  const assigned = selectWorkersAssigned.value;
  const value = role.id === 'research' ? assigned.researchers : assigned[role.id];
  const free = selectFreeWorkers.value;
  const bar = roleBar(value, selectWorkforceTotal.value);
  return (
    <li
      class="wrkr-role worker-role-row"
      data-role={role.id}
      data-tooltip={role.id === 'dig' ? DIG_TOOLTIP : undefined}
    >
      <div class="wrkr-role__info">
        <span class="wrkr-role__label worker-role-label">{role.label}</span>
        <span class="wrkr-role__bar" data-role-bar="" aria-hidden="true">
          <span data-filled="">{'█'.repeat(bar.filled)}</span>
          <span class="wrkr-role__empty">{'·'.repeat(bar.empty)}</span>
        </span>
        <span class="wrkr-role__effect worker-role-desc">{role.effect}</span>
      </div>
      <span class="role-controls">
        <Stepper
          value={value}
          available={value + free}
          multiplier={multiplier}
          onStep={(delta) => actions.stepRole(role.id, delta)}
          addLabel={(n) => `Add ${plural(n, role.worker)}`}
          removeLabel={(n) => `Remove ${plural(n, role.worker)}`}
          addDisabled={NO_FREE}
          removeDisabled={`no ${role.worker}s`}
          valueClass="stat-value role-count"
          data-role-stepper={role.id}
        />
      </span>
    </li>
  );
}

/**
 * The WRKR tab (Story 1.23, UX-DR15): the upkeep readout, the assigned and
 * nest lines, one `×1 ×10 ×MAX` row, and one role row per role in the role
 * data (`data/content/roles.ts`). Every step applies at once through an
 * action; the readout follows on the same render. Hooks: `[data-role]`,
 * `.role-count` (kept from WorkerAssignment), `[data-role-bar]`, `[data-upkeep]`,
 * `[data-net][data-trend]`, `[data-assigned]`, `[data-free]`, `.capacity-line`.
 */
export function WorkersTab({ actions }: { actions: WorkersActions }) {
  // Session UI state: the step size survives tab switches, not reloads.
  const [multiplier, setMultiplier] = useState<Multiplier>(1);
  const roles = rolesForPhase(selectPhase.value as Phase);
  return (
    <div class="wrkr" data-wrkr="">
      <div class="panel-title">WORKERS</div>
      <UpkeepReadout />
      <AssignedLine />
      <CapacityLine />
      <MultiplierRow value={multiplier} onChange={setMultiplier} />
      <ul class="wrkr-roles">
        {roles.map((r) => (
          <RoleRow key={r.id} role={r} multiplier={multiplier} actions={actions} />
        ))}
      </ul>
    </div>
  );
}

const labelOf = (id: RoleId) => ROLES.find((r) => r.id === id)?.label ?? id.toUpperCase();
const keyOf = (r: Reallocation | null) => (r ? `move:${r.from}:${r.to}` : 'none');

/**
 * WRKR's primary action (Story 1.23): the single most useful reallocation,
 * `> MOVE 4 TO GATHER`, or nothing. Like the next-action button (Story 1.21),
 * its target never changes under the thumb: it holds while pressed and for
 * the target-lock window after the last touch.
 */
export function WorkersPrimary({ actions, now = () => Date.now() }: { actions: WorkersActions; now?: () => number }) {
  const latest = selectReallocation.value;
  const shownRef = useRef<{ key: string; r: Reallocation | null } | null>(null);
  const lock = useRef<TargetLock>({ holding: false, lastTouchMs: null });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, setWake] = useState(0);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const shown = lockedTarget(shownRef.current, { key: keyOf(latest), r: latest }, lock.current, now(), nextActionBalance.targetLockMs);
  shownRef.current = shown;

  function touch(holding: boolean): void {
    lock.current = { holding, lastTouchMs: now() };
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = holding
      ? null
      : setTimeout(() => {
          timer.current = null;
          setWake((n) => n + 1);
        }, nextActionBalance.targetLockMs);
  }

  const r = shown.r;
  if (!r) return null;
  const from = r.from === 'free' ? 'the free workers' : labelOf(r.from).toLowerCase();
  return (
    <div
      class="wrkr-primary"
      data-reallocate={r.rule}
      onPointerDownCapture={() => touch(true)}
      onPointerUpCapture={() => touch(false)}
      onPointerCancelCapture={() => touch(false)}
      onPointerLeave={() => {
        if (lock.current.holding) touch(false);
      }}
    >
      <Button
        variant="primary"
        verb="MOVE"
        target={`${formatFull(r.count)} TO ${labelOf(r.to)}`}
        label={`Move ${r.count} from ${from} to ${labelOf(r.to).toLowerCase()}`}
        onPress={() => actions.moveWorkers(r.from, r.to, r.count)}
        data-action="reallocate"
        data-reallocate-from={r.from}
        data-reallocate-to={r.to}
      />
    </div>
  );
}
