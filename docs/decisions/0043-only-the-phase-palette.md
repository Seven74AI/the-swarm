# 0043. Only the phase palette; the first enemy is drawn in the Combat reveal

- **Status:** accepted (2026-11-22)
- **Source:** Story 8.3 (#311) · FR43 (palettes), UX-DR27 · DESIGN.md "One color per phase", "Phase reveal" ·
  ADR 0014 (phase reveal and cross-fade)

## Context

Story 1.8 put the six phase palettes in `ui/styles/tokens.css` and bound the `--color-*` aliases on
`<html data-phase>`. The legacy `src/main.css` still carried its own earth-tone theme: registered `--bg-primary`,
`--accent-glow`, … variables, a `body.phase-*` override per phase, a 3 s `transition` on `html, body`, and literal
colours (tooltip navy, prestige gold, tree green, space cyan). Wherever a legacy class was still drawn (the top bar,
the pause button, tooltips, panels) the screen showed colours from no phase palette. ADR 0014 left the first enemy
drawing to this story.

## Decision

- **tokens.css is the only place a colour is written.** Every other stylesheet in `src/` uses the aliases
  (`var(--color-bg|raised|line|edge|dim|accent|warn|on-accent|scrim)`). A tint is a token at an opacity:
  `color-mix(in srgb, var(--color-accent) N%, transparent)`. The legacy variables, their `@property` registrations,
  the `body.phase-*` colour overrides and the legacy theme transition are gone. The `body.phase-*` classes stay
  (Space's layout hooks and tests read them); they no longer set colours.
- **Legacy mapping** (main.css): page `bg`; panels and buttons `raised` fill; panel rules `line`; text `accent`;
  secondary and muted text `dim`; success `accent`; danger and refusals `warn`; overlays `scrim`. Prestige gold and
  tree green become `accent`, so the Legacy screens repaint with the phase like the rest.
- **One cross-fade.** Only PhaseReveal.css transitions the palette (3 s, 300 ms under reduced motion, ADR 0014).
  `html` and `body` take `var(--color-bg)` from the transitioning aliases, so they fade with it, and boot and prestige
  repaint at once. `--anim-theme-shift` is removed.
- **Checks.** `tests/unit/ui/theme/onlyPhasePalette.test.ts` fails on any colour literal or named colour in a
  stylesheet other than tokens.css, on a legacy palette variable, and on a colour literal in a TSX paint attribute.
  `tests/e2e/palette.spec.ts` opens every tab, segment and sheet (resource, settings, offline summary, decision,
  battle summary) in Egg Laying, Colony and Combat, and requires every computed colour of every element and
  pseudo-element to be one of that phase's tokens or the scrim (at any alpha), or transparent.
- **The first enemy creature:** `ui/scene/EnemyCreature.tsx`, a beetle seen from above (split shell, open mandibles,
  six jointed legs, antennae), line-work in `currentColor` with `fill="none"`, `aria-hidden`, hook
  `[data-creature="enemy"]`. Only the Combat reveal draws it, above the phase name; the spec checks that no Colony
  screen and no earlier reveal draws one. It is one generic enemy, whatever `nextEnemy` is: the reveal's line
  ("SOMETHING MOVES IN THE TUNNELS. IT IS NOT OURS.") names no species, and each enemy type gets its own drawing
  with the vector scenes (Story 8.5 onwards), in `ui/scene/`.

## Consequences

- A new colour is a new token in tokens.css (and DESIGN.md), never a literal elsewhere.
- The Expansion map canvas (`ui/panels/MapPanel.ts`) still paints tile colours from TS constants. It is drawn only
  from Expansion on, outside this story's MVP phases; the map redraw in Epic 6 moves it onto the tokens.
- axe's `color-contrast` rule stays off in accessibility.spec.ts: with only tokens left, it still flags the
  decorative `edge` meter cells and the strip's `dim` labels, which DESIGN.md's contrast table rates on its own
  terms (tests/unit/phaseTokens.test.ts recomputes it).
