# 0020. Desktop columns are a second layout of the same shell, driven by one viewport signal

- **Status:** accepted (2026-11-21)
- **Source:** Story 1.29 (#259) · FR47 (layout), UX-DR6 · DESIGN.md → Layout & Spacing, Components → Desktop left
  rail and dialog · EXPERIENCE.md → Responsive & Platform · mockups/key-desktop.html · builds on ADR 0011

## Context

From 1024 px the game should show NEST and the active tab side by side, with a left rail instead of the tab bar,
while staying the same game. Every e2e spec runs at a desktop viewport, and the legacy panels keep their hooks, so a
second DOM tree for desktop would double every hook and every mount.

## Decision

- **One DOM, two layouts.** `Shell.tsx` renders the same sections, hosts and buttons at every width.
  `data-layout="columns" | "single"` on `[data-shell]` switches `shell.css` to a grid: strip across the top,
  `TabBar` as a 160 px rail (`data-rail="true"`, full `railLabel`s from `tabs.ts`, key hints), NEST's section in
  column 1, the column tab's section in columns 2–3, and each primary slot under its column (`#panels` and
  `[data-primary-zone]` become `display: contents`). Content is at most 1280 px wide. Below 1024 px nothing changes:
  the single column, centered at 600 px.
- **The viewport is a platform service.** `platform/viewport.ts` `createViewport()` gives `wide` (a signal on
  `(min-width: 1024px)`, with change events); main passes it to `createTabShell({ wide })`. ui/ never calls
  `matchMedia`.
- **The tab shell decides what is on screen.** `columns` = wide and more than NEST (Phase 1 stays one column).
  `columnTab` = the last tab picked other than NEST (BUILD first, also remembered on a phone, so widening the window
  shows it). `visible` = `[active]`, or `['nest', columnTab]` in columns; sections, primary slots and the `•` dots
  follow `visible`. `active` is still the picked tab (rail highlight); picking NEST in columns focuses column 1
  (`tabIndex=-1`) and leaves `columnTab` alone. Each column keeps its own scroll position.
- **Sheets** are centered dialogs (max 480 px) from 1024 px, by a media query in `Sheet.css`; the controller and
  components are unchanged.

## Consequences

- No game-logic difference between layouts; layout-only specs set their viewport (phone specs use 360×640).
- At the default e2e viewport (1280×720) NEST and the column tab are visible together, so a spec that asserts a
  NEST element is hidden behind another tab must use a phone viewport.
- Story 1.30's Space shortcut should act on `columnTab`'s primary action in columns (UX-DR41); the rail's hints read
  the key bindings from settings, and show none while shortcuts are off.
