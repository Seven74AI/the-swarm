# 0018. The chronicle: event lines kept beside the game state, in the save envelope

- **Status:** accepted (2026-11-21)
- **Source:** Story 1.26 (#256) · UX-DR30, UX-DR31 · arch D4 ("inside the save: … the event log (last 100 lines)") · AR18 · ADR 0001

## Context

The event lines lived only in `EventLog`'s memory, so LOG lost its history on every reload, and the one-time lines
(first egg, first worker, "now available" when a panel is revealed) fired again after each reload. The story asks
for the last 100 lines in the save, newest first, with lines that point at something jumping to it.

The lines are written by listeners from events (narrative, arch "Event System"), and no listener may write the game
state (AR18, `tests/unit/listenerStateWrites.test.ts`). Moving line generation into the tick and every action to
keep the log in `GameState` would mean routing narrative through the simulation.

## Decision

- **A chronicle store beside the game state:** `src/state/chronicle.ts` `createChronicle(saved?)` holds
  `{ entries, milestones }` in its own signal. `entries` are `{ message, timestamp, target? }`, newest first, capped
  at `CHRONICLE_MAX_LINES` (100); `target` is a panel id from the tab registry. `milestones` names the one-time lines
  already written this run, so a reload never repeats them. `normalizeChronicle` reads any saved value defensively.
- **Saved in the envelope:** `SaveData.chronicle` (save v17). main creates the chronicle from `load().chronicle` and
  gives `SaveManager.setChronicleSource(() => chronicle.snapshot())`, so every save path (autosave, action saves,
  beforeunload, the tick-failure snapshot, export) writes it. The v16 → v17 migration adds an empty chronicle and
  marks the one-time lines the save has already passed (from its phase and counts).
- **Writers and readers:** `EventLog` (NEST's newest 3) writes lines into the chronicle and redraws from it; LOG's
  `ChronicleLog` (`src/ui/log/`) draws all of them. Writing the chronicle from a listener is allowed: it is not
  game state.
- **Prestige** starts a new chronicle (`prestige_triggered` → reset, then one opening line): the GDD wipes the run
  except LP, Legacy upgrades, lifetime stats and the victory record. Lifetime stats stay visible on LOG.
- **Jumps:** `src/ui/log/jump.ts` `createLineJump` opens the target panel's tab (and FRONT segment) in the tab shell
  and scrolls it into view, marking it `[data-jumped]` for 2 s; a line whose panel the phase doesn't show is plain text.

## Consequences

- Save import (Story 2.11) must load the imported chronicle too (`chronicle.load`).
- New one-time lines get a milestone id; if an existing save could already be past them, a migration marks them.
- LEGACY is shown by `selectLegacyUnlocked` (prestige condition met, or prestiged before, or victory), not by phase:
  the prestige panels are created with LOG (Colony) inside `[data-log-section="legacy"]`.
