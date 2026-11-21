# 0022. The character grid is measured once by the shell and read through the root and one signal

- **Status:** accepted (2026-11-21)
- **Source:** Story 1.31 (#261) · UX-DR4, UX-DR5 (height rules), UX-DR6 (landscape), NFR7, NFR9 ·
  DESIGN.md → Layout & Spacing · builds on ADR 0009 (Meter), ADR 0011 (shell), ADR 0020 (columns)

## Context

Panels are designed on a 36-column monospace grid, but at 200 % text or 320 px wide far fewer columns fit. DESIGN.md
makes the column count an output: `cols = floor(contentWidth / advanceWidth(body))`, with a reflow table for ≥ 36,
28–35 and < 28 columns. Most of the reflow is CSS (wrapping, stacking, borders), some is markup (a meter's cell count
and its `74 % ████····` form), and the game's UI is many Preact roots plus legacy DOM panels, so a context provider
reaches only part of it.

## Decision

- **Pure rules in `ui/primitives/charGrid.ts`:** `gridColumns(width, advance)` (a missing measurement counts as
  unlimited, the full design), `gridClass(cols)` → `full | medium | narrow`, `meterCellsFor(cols, designed)`
  (`cols − 8` below 36, never more than designed), `DESIGN_COLS = 36`, `BOX_DRAWING_MIN_COLS = 28`.
- **One measurement, in `ui/shell/charGrid.ts`:** the App creates `createCharGrid({ root: <html>, cols: appGridCols })`
  and the Shell attaches it. It measures the narrowest visible tab column (each desktop column follows the rule, so
  the narrowest decides) against a hidden probe of ten zeros in the body font, and remeasures on the next frame
  after a resize of the shell, a column or the probe (so a text-size change counts even if the window doesn't).
- **Two outputs.** CSS keys off `:root[data-grid=…]` (`ui/shell/reflow.css`; the count is also in `data-grid-cols`, and the root's inline style stays free); components read the
  count with `useGridCols()`, whose context defaults to the module signal `appGridCols`, so every Preact root follows
  it without a provider and tests can provide their own.
- **Pinned rows grow with the text.** The primary zone and tab bar have minimum (not fixed) heights; the Shell
  measures them into `--shell-primary-h` / `--shell-tab-bar-h`, which pad the scroll area. Below 480 px of height the
  primary zone un-pins (CSS only); below 560 px NEST shows one event line.
- **Font sizes are rem.** The root no longer pins 16 px; `tests/unit/ui/remSizes.test.ts` refuses px font sizes in
  any stylesheet and a viewport tag that disables zoom.

## Consequences

- New text components should wrap rather than clip and may add `:root[data-grid="narrow"]` rules in their own CSS
  (or in `reflow.css` for legacy panels). A meter gets the grid behaviour for free.
- `tests/e2e/text-reflow.spec.ts` checks every tab and the resource sheet at 320 px, 200 % text, both, below 560 px
  and below 480 px: no element past the screen edges, nothing cut off sideways, nothing spilling out of the strip,
  primary zone or tab bar, and 44 px targets. New screens should be added to it.
- On the full and medium grids a primary label still truncates its target with an ellipsis (DESIGN.md); below 28
  columns the target wraps instead.
