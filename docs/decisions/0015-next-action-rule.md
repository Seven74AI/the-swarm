# 0015. The next-action rule: one pure function, data tables, intents and a target lock

- **Status:** accepted (2026-11-21)
- **Source:** [Game architecture](../../_bmad-output/planning-artifacts/architecture/architecture-the-swarm-2026-11-20/game-architecture.md)
  System Location Mapping (Next action) · Story 1.21 (#251) · UX-DR12 · EXPERIENCE.md "Next-action rule"

## Context

NEST (after Phase 1), WRKR and the offline summary each show one button: the single most useful next action.
Three screens must agree, the rule must be testable without a DOM, and the UI may not import `systems/` or
`phases/transitions.ts` (ADR 0006, Story 1.18).

## Decision

- **`getNextAction(state)`** in `src/systems/NextAction.ts` is pure and returns a `NextAction`:
  `{ kind: 'act', rule, key, verb, target?, intent, panel }` or `{ kind: 'none', key, nextAffordable }`.
  Rules, first match wins: `goal` (the latch of Story 1.19 points at the next phase, the same check
  `continuePhase` makes), `food`, `capacity`, `critical_path`, `affordable`, then none.
- **Thresholds** live in `src/data/balance/nextAction.ts` (`foodCriticalSeconds`, `capacityCriticalPercent`,
  `targetLockMs`, `minGuards`). **Critical-path tables** live in `src/data/content/criticalPath.ts`, one ordered
  `ItemRef[]` per phase; the rule never names an item itself.
- **Items** (`ItemRef`: upgrade, building, mutation, equipment, ship, research, auto_research, auto_building) are
  described once in `NextAction.ts`: panel, price, the system check the action uses, label and intent. An item
  is suggested only when its panel is open in the phase (`data/content/tabs.ts`).
- **`ActionIntent`** names the action in `actions/` that performs the suggestion; `actions.perform(intent)`
  dispatches it (`src/actions/intent.ts`), so the button goes through the usual validation, single write and
  events. Tests check that every suggestion is accepted by its action.
- **`selectNextAction`** (state/selectors.ts) re-evaluates on every write but hands back the previous object while
  the suggestion is unchanged (same key, rule and label; for none, the same item and whole seconds), so it notifies
  only when the button would change. `inSec` is whole seconds, so a countdown notifies at most once a second.
- **Target lock:** `ui/shell/targetLock.ts` `lockedTarget(shown, latest, lock, now, lockMs)` keeps the shown target
  while held and for `targetLockMs` after the last press, release or keyboard activation; a new label for the same
  key is taken at once. `ui/shell/NextActionButton.tsx` applies it around the primary `Button`
  (`[data-next-action=<rule>|none]`, `[data-next-key]`, `data-action="next-action"`). CONTINUE does not repeat.

## Consequences

- Story 1.22 mounts `NextActionButton` in NEST's primary zone after Phase 1; the offline summary (Epic 2) and the
  sim policy (Story 3.7) call `getNextAction` / `selectNextAction` instead of re-deriving a choice.
- New purchasable content must be added to `listItems()` (and to a critical-path table if it serves a goal).
- `NEXT AFFORDABLE` estimates use the rates the state implies (net food, territory wood/stone/nectar); stocks with no
  steady income (combat drops, space resources, workers) make an item unreachable by waiting, and it is skipped.
- Phase 6's TRANSCEND label arrives with the Transcendence goal; no transition leaves Transcendence.
