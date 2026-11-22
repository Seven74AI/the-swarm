# 0016. The workforce: role data, whole-step actions and the reallocation rule

- **Status:** accepted (2026-11-21)
- **Source:** Story 1.23 (#253) · UX-DR15 · EXPERIENCE.md "Tabs" (WRKR) · DESIGN.md "Role row", "Upkeep readout" · ADR 0015

## Context

WRKR replaces WorkerAssignment, the upkeep part of FoodDisplay and AutoProductionPanel. It needs one row per
role (Forage arrives in Story 3.4), steppers with ×10 and ×MAX, Research counted with the other roles, and a
primary action that is "the single most useful reallocation". Researchers are stored apart: assigning one takes it
out of `resources.workers`, and the old `assignResearcher` could take a worker that already had a job.

## Decision

- **Role data** in `src/data/content/roles.ts` (`ROLES`, `rolesForPhase`): id, label, accessible worker noun,
  effect line, unlock phase. A new role is a new entry; the UI draws whatever the phase has.
- **Workforce rules** in `src/systems/Workforce.ts`, pure: `workforceTotal` (workers + researchers),
  `assignedTotal` (job roles + researchers), `freeWorkers`, `roleCount`, `stepRole(s, role, delta)` and
  `moveWorkers(s, from, to, count)` (`from` may be `'free'`). They return the same state when a step can't be taken.
- **Actions**: `actions.stepRole(role, delta)` applies a whole ×1/×10/×MAX step in one write (refusing
  `no_free_workers` / `none_assigned`); `actions.moveWorkers(from, to, count)` moves in one write.
  `assignResearcher` takes only a free worker.
- **Reallocation rule** `getReallocation(state)`: it answers the same critical states as `getNextAction`
  (`isFoodCritical`, `isCapacityCritical`, exported from `NextAction.ts`), sized for WRKR: food → the fewest
  workers to GATHER that stop the loss (free first, then TEND, DIG, GUARD above `minGuards`); capacity → every free
  worker to DIG, else one from TEND; otherwise null. `selectReallocation` hands back the same object while the
  suggestion is unchanged. `WorkersPrimary` reuses the target lock of ADR 0015.
- **Mounting**: UIRoot keeps the hosts (`#worker-assignment`, `wrkr_primary` in WRKR's primary zone,
  `automation_panel`); main renders `WorkersTab`, `WorkersPrimary` and `AutomationSection` (`src/ui/wrkr/`)
  into them.

## Consequences

- NEST's next action stays one step at a time (an intent), while WRKR offers the whole move; both come from the
  same critical checks, so they never point in opposite directions.
- Upkeep still counts only `resources.workers` (researchers eat nothing), as before; the readout shows what the
  simulation does.
