# 0011. A tab registry in data and one portrait shell host every panel

- **Status:** accepted (2026-11-21)
- **Source:** [Game architecture](../../_bmad-output/planning-artifacts/architecture/architecture-the-swarm-2026-11-20/game-architecture.md)
  D7 (UI shell) · Story 1.15 (#245) · FR45, AR10, UX-DR5, UX-DR9 · EXPERIENCE.md (Information Architecture)

## Context

The prototype revealed 23 panels one after another in a single scrolling column (`PHASE_PANELS` in
`ui/PhaseContent.ts`). The mobile rework needs 5 tabs revealed by phase, FRONT segments, a primary action and a tab
bar under the thumb, while the legacy panels keep their `data-*` / `id` hooks until each one is rewritten.

## Decision

- **`src/data/content/tabs.ts`** is the one source of what shows when: `TABS` (bar order, `unlockPhase`),
  `SEGMENTS` (FRONT: WAR, MAP, STARS) and `PANEL_PLACEMENT` (`panelId → { tab, segment?, zone?, unlockPhase }`).
  `tab: 'strip'` is the global strip at the top; `zone: 'primary'` is the tab's pinned primary zone.
  `PHASE_PANELS` is gone: `PhaseContent.getActivePanels` returns `panelsForPhase(phase)`. `MAX_TABS` (5) lives in
  `src/data/constants.ts`; a test asserts no phase shows more.
- **`ui/shell/tabShell.ts`** (`createTabShell({ phase, affordable })`) holds the session-only UI state: the active
  tab (back to NEST when a tab disappears, e.g. after prestige), the FRONT segment (opens on the newest segment when
  the row grows), per-tab scroll positions, and the `•` dots. Nothing in it is saved.
- **The dot:** `state/affordances.ts` `affordableKeys(state)` lists what can be bought now as `<panelId>:<item>`;
  `selectAffordableKeys` joins them into one string, so it notifies only when the set changes. A tab gets `•` when a
  key on one of its revealed panels appears while the player is on another tab. It latches until the tab is visited.
  It is off at boot. No numeric badges.
- **`ui/shell/Shell.tsx`** (rendered by `App`) lays out the strip, the scroll area (`#panels`, one `section` per tab,
  `hidden` unless active), the primary zone and `TabBar` (hidden in Phase 1). Legacy `UIRoot.mount(hosts)` receives
  `ShellHosts` (`ui/shell/hosts.ts`) and appends each panel into the host of its placement. Hosts have no Preact
  children, so re-renders never touch the legacy DOM.
- **Layout:** primary zone 64 px and tab bar 52 px, `position: fixed` above `env(safe-area-inset-bottom)`; the scroll
  area's bottom padding and `scroll-padding-bottom` equal their combined height. Single column, centred at 600 px max
  (the desktop rail is Story 1.29).

## Consequences

- E2E specs open a tab before touching a panel inside it: `tests/e2e/helpers/tabs.ts` `openTab(page, tab, segment?)`.
- Unit tests that mount `UIRoot` without Preact build the hosts with `tests/unit/helpers/shellHosts.ts`.
- A new panel or tab is a registry entry plus a `UIRoot` factory; later stories replace each legacy panel in place.
- The NEST primary zone holds the legacy lay-egg button until the next-action rule; other tabs' primary zones are
  empty until their stories add the action.
