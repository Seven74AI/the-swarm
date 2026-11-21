# 0025. Panels are Preact views placed by the tab registry; UIRoot is gone

- **Status:** accepted (2026-11-21)
- **Source:** Story 1.36 (#266) · AR26 (removals) · ADR 0004, 0011
- **Supersedes:** the mounting parts of ADR 0011 (`UIRoot.mount(hosts)`, `ShellHosts`, `tests/unit/helpers/shellHosts.ts`)

## Context

Stories 1.14–1.33 migrated the panels to Preact one by one, but each migrated view still went through the legacy
`UIRoot`: a registry of factories that created a host `div`, hid it, appended it into a shell host found by
selector, and showed it on phase enter (`createPanel`, `showPanel`). The last vanilla-DOM panels (FoodDisplay,
EventLog's NEST lines, the prestige panels, Transcendence) and `ui/components/` (NumberDisplay, ProgressBar) kept
the old pattern alive for new code to copy.

## Decision

- **Views, not hosts.** `Shell` takes `views: ShellViews` (`strip`, `tabs`, `segments`, `primary`) and renders
  them inside its containers. `ui/gameViews.tsx` `gameViews(deps)` builds the game's views from what main passes in,
  in the placements of `data/content/tabs.ts`.
- **`Panel`** (`ui/shell/Panel.tsx`) is one registry panel: absent until its phase reveals it, then its root element
  keeps the old host's id, classes and `data-*` hooks, plus `[data-panel=<id>]` (where an event line jumps to) and
  `.panel-unlocked .panel-revealed` (the reveal animation). Newly revealed panels cascade in `REVEAL_STAGGER_MS` apart by
  their place among the phase's panels. As in #360, the delay is only given to a panel on screen at
  that reveal and is dropped once its reveal animation ends, so reopening a tab never replays the wait.
- **`PanelReveal`** (`ui/shell/panelReveal.ts`, provided by `App` through `PanelRevealContext`): the session's set of
  revealed panels. `PhaseContent.onPhaseEnter(phase, panels)` reveals a phase's panels at boot (before the first
  render) and on every commit; each reveal is announced as `panel_revealed`. Like UIRoot's lazy panels, a revealed
  panel stays for the session: a prestige never takes it away (the prestige card is read after a reset).
- **The legacy Phase 4–5 panels** (MAP: MapPanel, ExpeditionPanel; STARS: SpaceshipPanel, ExplorationPanel,
  CosmicPanel, StarmapPanel) are mounted directly by their FRONT segment (`ui/front/FrontSegments.tsx`, through
  `LegacyPanel`, which creates each element once). They and their `refusal.ts` helper are the only files left in
  `ui/panels/`, until Epic 6 rebuilds them.
- **Moved out of UIRoot:** the top bar and pause button (`ui/shell/TopBar.tsx`; main's `togglePause`, and the
  `.game-paused` body class follows `selectPaused`), the EventLog (`ui/log/EventLog.ts`, which only writes the
  chronicle and now forwards `workers_changed` to the tenth-worker line itself), NEST's lines (`ui/nest/EventLines.tsx`),
  WRKR's food stock (`ui/wrkr/FoodStock.tsx`), LEGACY's prestige card and tree (`ui/log/Prestige.tsx`, with new
  prestige selectors) and Transcendence (`ui/endgame/Transcendence.tsx`). `OnboardingTooltip` moved beside
  `OnboardingManager` (Story 8.10 replaces both with coach marks). `open_prestige_tree` is gone: the tree button
  scrolls to the tree.

## Consequences

- `tests/arch/architecture.test.ts` fails if `ui/UIRoot.ts`, `ui/components/` or `ui/shell/hosts.ts` come back, if
  `ui/panels/` holds a file not in `LEGACY_PANELS` (a list that only shrinks), or if anything outside `ui/front/`
  imports a legacy panel.
- A new panel is a registry entry plus a `Panel` in `gameViews`. Unit tests render views directly (no hosts) and
  reveal panels with `createPanelReveal()`; without a reveal context a `Panel` always shows.
- A panel before its phase is not in the DOM (E2E: `toHaveCount(0)` or `toBeHidden()`); a revealed one in a closed
  tab is hidden (`toBeVisible()` after `openTab`).
- `bootstrap()` returns `panels` instead of `ui`.
