# 0023. Decoration is visual only, and one polite announcer says what changed

- **Status:** accepted (2026-11-21)
- **Source:** Story 1.32 (#262) · UX-DR39, UX-DR40, NFR15 · ADR 0008, 0009, 0011, 0020

## Context

The terminal look writes meaning with characters: `·` separators, `→` level arrows, `[ ]` brackets, block-cell
meters, 4-letter labels (`CHTN`) and resource glyphs. Screen readers read them all. Buttons were named with an
`aria-label` that differed from their visible text and swallowed the cost line (WCAG 2.5.3). Nothing told a screen
reader that a goal was met, a phase entered, a battle ended, a decision arrived or the colony was starving. The phase
reveal's typed line lived in an `aria-label` on a paragraph. Reduced motion only reached a few elements, and the
desktop columns tabbed rail-last.

## Decision

- **`ui/primitives/Deco.tsx`**: `Abbr({shown, full})` (short form `aria-hidden`, full word `.visually-hidden`),
  `Sep` (` · ` read as a comma), `Arrow` (` → ` read as "to"), and `decorate(text)`, which turns the ` · ` and ` → `
  in a typed string into them. `Card` (level, effect, cost) and `Button` (cost line) decorate strings themselves;
  prices (`PriceText`), shortfalls, the strip, tabs, the battle summary and WAR use `Abbr` for glyphs and labels.
- **Button names come from the visible verb and target.** No `aria-label`; the cost line is `aria-hidden` and is the
  button's description (`aria-describedby`). With `label` (a face of decoration such as `[+]`) the face is hidden
  and the label is visually-hidden text. **`Meter` requires `label`** (an unnamed progressbar fails axe).
- **One announcer** (`ui/shell/announcer.ts` + `LiveRegion.tsx`, mounted in App, `[data-announcer]`): a polite
  `role="status"` region, present from boot, holding the last 3 lines (each a new keyed node, so repeats and two lines
  at once are read). `ui/shell/announcements.ts` `bindAnnouncements` (main) says: goal met, phase entered
  (`phase_committed`), decision arrived (`decision_spawned`; the sheet also takes focus), starving
  (`selectStarving`) and capacity reached (`selectCapacityReached`). States are announced on their false → true
  edge, at most once per `ANNOUNCE_COOLDOWN_MS`, never at bind time. Main announces `battleLine(result)` when the
  battle summary opens. A costly ignore and a failed save (`SaveManager.onSaveFailed`, told once per failing
  streak) are toasts, and the toast host is itself a polite status region; the save failure is also logged.
  Nothing listens to resource changes, so values are never announced per tick.
- **NEST event lines** are an `<ol>` inside the `role="log"` region, and a new line leaves the old nodes in place.
- **Typing is visual only:** the phase reveal types into an `aria-hidden` span next to the full line.
- **Desktop focus** (`ui/shell/focusOrder.ts`, bound by the Shell in columns): Tab / Shift+Tab go strip → rail →
  column 1 and its primary → columns 2–3 and theirs; the rail is also rendered before the columns. The phone layout
  keeps the DOM order (strip → tab → primary action → tab bar). CSS `reading-flow` was tried and doesn't reorder
  grid items under `display: contents`.
- **Reduced motion** (`ui/styles/motion.css`, keyed to `:root[data-reduced-motion="true"]`): every transition in
  `body` ends at once and every animation runs once for 1 ms (so `animationend` still fires); the palette fade and
  the legacy theme shift take 300 ms. `settings.crt` is the CRT mode in effect (OFF under reduced motion), bound to
  `<html data-crt>`; Story 8.4 draws it (ADR 0046).

## Consequences

- New UI text with separators, arrows, glyphs or abbreviations goes through `decorate` / `Abbr`; a new progressbar
  needs a `label`. `tests/e2e/accessibility.spec.ts` runs axe (WCAG 2 A/AA + best practice; colour contrast is left
  to Story 8.3's palette migration) and scans the accessibility tree for decoration on every tab and the sheets.
- Tests that read visible text with decoration use `visibleText` (unit `tests/unit/helpers/a11y.ts`, e2e
  `tests/e2e/helpers/text.ts`); `spoken` / `described` read what assistive tech reads.
- A new key change to announce is one more line in `bindAnnouncements`, edge-triggered, never per tick.
