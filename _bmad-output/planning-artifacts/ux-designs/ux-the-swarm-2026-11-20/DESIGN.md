---
name: THE SWARM
description: Mobile-first ant-colony idle game. Vector scene, terminal UI. One phosphor colour per phase on near-black.
title: "THE SWARM — DESIGN"
status: draft
created: 2026-11-20
updated: 2026-11-20
sources:
  - _bmad-output/planning-artifacts/gdds/gdd-the-swarm-2026-11-20/gdd.md
  - _bmad-output/planning-artifacts/gdds/gdd-the-swarm-2026-11-20/epics.md
  - _bmad-output/planning-artifacts/briefs/brief-the-swarm-2026-11-20/brief.md
colors:
  # Phase sets. Each phase is one phosphor (accent) on one near-black.
  # dim = accent mixed into bg, tuned to ≥ 4.6:1 on the raised surface. line = 25 % mix. raised = 8 % mix.
  egg-bg: '#0d0a04'
  egg-raised: '#201704'
  egg-line: '#4a3403'
  egg-dim: '#ad7801'
  egg-accent: '#ffb000'
  colony-bg: '#0b0d08'
  colony-raised: '#1a2014'
  colony-line: '#3a482e'
  colony-dim: '#75905d'
  colony-accent: '#c8f7a0'
  combat-bg: '#0f0807'
  combat-raised: '#22110e'
  combat-line: '#4b241c'
  combat-dim: '#ca6149'
  combat-accent: '#ff7a5c'
  expansion-bg: '#060d09'
  expansion-raised: '#102016'
  expansion-line: '#244a33'
  expansion-dim: '#499567'
  expansion-accent: '#7dffb0'
  space-bg: '#050a0f'
  space-raised: '#0e1a22'
  space-line: '#223d4b'
  space-dim: '#4f8ba6'
  space-accent: '#7ad7ff'
  transcendence-bg: '#000000'
  transcendence-raised: '#141414'
  transcendence-line: '#404040'
  transcendence-dim: '#808080'
  transcendence-accent: '#ffffff'
  # Phase-invariant.
  warn: '#ff9a6b'
  highlight: '#ffffff'
  scrim: '#000000b3'
  # Runtime aliases. The active phase binds these; components reference only aliases.
  bg: '{colors.egg-bg}'
  raised: '{colors.egg-raised}'
  line: '{colors.egg-line}'
  dim: '{colors.egg-dim}'
  accent: '{colors.egg-accent}'
  on-accent: '{colors.egg-bg}'
typography:
  mono:
    fontFamily: 'ui-monospace, "SF Mono", "Roboto Mono", Menlo, Consolas, monospace'
  display:
    fontFamily: '{typography.mono.fontFamily}'
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: 0.1em
  title:
    fontFamily: '{typography.mono.fontFamily}'
    fontSize: 20px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: 0.08em
  value:
    fontFamily: '{typography.mono.fontFamily}'
    fontSize: 15px
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: '{typography.mono.fontFamily}'
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.3
  meta:
    fontFamily: '{typography.mono.fontFamily}'
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.3
  label:
    fontFamily: '{typography.mono.fontFamily}'
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1.2
rounded:
  none: 0px
  phone: 30px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 24px
  '6': 32px
  hit-min: 44px
  margin-mobile: 14px
  strip-height: 56px
  tab-bar-height: 52px
  map-tile: 40px
  grid-columns: 36
  thumb-zone: 40vh
vector:
  stroke: 1.2px
  stroke-strong: 1.6px
  wall-opacity: 0.55
  soil-fill-opacity: 0.07
  grain-opacity: 0.3
  glow: 'drop-shadow(0 0 3px accent @ 55–70 %)'
  scanlines: 'repeating 1px dark line every 3px, 16–20 % black'
  glyph-grid: 24px
  glyph-stroke: 1.6px
components:
  resource-strip:
    background: '{colors.bg}'
    rule: '{colors.line}'
    height: '{spacing.strip-height}'
    glyph: '{vector.glyph-grid}'
    label: '{typography.label}'
    value: '{typography.value}'
  tab-bar:
    background: '{colors.bg}'
    rule: '{colors.line}'
    height: '{spacing.tab-bar-height}'
    active: '{colors.accent}'
    inactive: '{colors.dim}'
    font: '{typography.meta}'
  button-primary:
    border: '1.5px {colors.accent}'
    text: '{colors.accent}'
    background: transparent
    font: '{typography.value}'
    minHeight: 50px
    rounded: '{rounded.none}'
  button-secondary:
    border: none
    text: '{colors.dim}'
    font: '{typography.meta}'
    minHeight: '{spacing.hit-min}'
  stepper:
    buttonSize: '{spacing.hit-min}'
    value: '{typography.value}'
  card:
    border: '1px {colors.line}'
    background: '{colors.bg}'
    padding: '{spacing.3}'
    rounded: '{rounded.none}'
  meter:
    font: '{typography.meta}'
    fill: '█'
    empty: '·'
  bottom-sheet:
    background: '{colors.bg}'
    border-top: '1.5px {colors.accent}'
    scrim: '{colors.scrim}'
  event-line:
    font: '{typography.meta}'
    color: '{colors.dim}'
    newest: '{colors.accent}'
  nest-scene:
    soil: '{colors.accent} @ {vector.soil-fill-opacity}'
    walls: '{colors.accent} @ {vector.wall-opacity}'
    carved: '{colors.bg}'
    creatures: '{colors.accent}'
  map-tile:
    size: '{spacing.map-tile}'
    stroke: '{colors.accent} @ 0.3'
    claimed: '{colors.accent} fill @ 0.18, stroke @ 1'
    selected: '2.5px {colors.highlight}'
    rival: '{colors.warn}'
  title-cinematic:
    palette: Phase 1 only
---

# DESIGN.md — THE SWARM

## Brand & Style

**Vector scene, terminal UI.** The colony and its world are drawn as glowing vector line-work: soil, tunnels, chambers, ants, enemies, the surface map, planets. Everything you read or press is a terminal: monospace text, bracketed buttons, block-character meters, boxed panels. Both are drawn in one phosphor colour per phase on near-black, with faint scanlines. It's an old monochrome monitor showing a living ant farm.

The look comes from the owner's choices in Discovery: the terminal direction (C), then "vector for the elements, ASCII for the rest", then vector for the soil and tunnels too. The terminal carries the austerity of A Dark Room and Universal Paperclips. The vector scene carries Pillar 1: you can see every ant.

Four rules carry the identity:

1. **One colour per phase.** Each phase is a single phosphor. Entering a phase repaints everything at once, and that repaint is the reveal (GDD: "the reveal is the reward"). No phase shows another phase's colour before it is reached, the title cinematic included.
2. **The world is drawn and the interface is typed.** If it exists in the colony's world, it's vector. If it's information or a control, it's monospace text. Glyph icons are the one bridge: small vector marks that sit inside the text.
3. **Ants, not stats.** The nest scene shows the colony as countable creatures. The exact integer always sits next to it in text.
4. **Quiet chrome, loud moments.** Panels and labels are dim and still. Glow, motion and the full accent are saved for what just changed and for what the player should press.

Not: emoji, gradients, rounded "app" cards, confetti, red badge counts, or a second accent colour inside a phase.

## Colors

Every phase defines five values. Components use only the aliases (`bg`, `raised`, `line`, `dim`, `accent`), so a phase change rebinds five variables and nothing else.

| Phase | `bg` | `accent` | `dim` | Register |
|---|---|---|---|---|
| 1 Egg Laying | `#0d0a04` | `#ffb000` amber | `#ad7801` | One lamp in the brood chamber |
| 2 Colony | `#0b0d08` | `#c8f7a0` pale phosphor green | `#75905d` | The classic terminal; the nest is alive |
| 3 Combat | `#0f0807` | `#ff7a5c` alarm red-orange | `#ca6149` | First threat |
| 4 Expansion | `#060d09` | `#7dffb0` mint | `#499567` | The world above |
| 5 Space | `#050a0f` | `#7ad7ff` cyan | `#4f8ba6` | Cold, off-planet |
| 6 Transcendence | `#000000` | `#ffffff` white | `#808080` | The colour drains out |

- `accent`: values, active controls, the newest event line, creatures, and the walls of the scene at reduced opacity.
- `dim`: labels, older event lines, inactive tabs, secondary text. Never a value the player acts on.
- `line`: rules, card borders, empty meter cells. Never text.
- `raised`: sheet and selected-card backgrounds. Cards are otherwise transparent on `bg`.
- `warn` (`#ff9a6b`, every phase): negative deltas, shortfalls ("needs 60 more"), rival nests on the map.
- `highlight` (`#ffffff`, every phase): the selected map tile, pending markers, and inline "new" emphasis. Used sparingly.

**Contrast (measured, WCAG 2.x):** `accent` on `bg` is between 7.7:1 (Combat) and 21:1. `accent` on `raised` is ≥ 7.1:1. `dim` is ≥ 5.0:1 on `bg` and ≥ 4.6:1 on `raised` in every phase. `warn` is ≥ 8.0:1 on every `raised`. Text on an accent fill uses `on-accent` (= `bg`) and is ≥ 7.7:1.

**Hue never carries meaning alone.** Combat's accent and `warn` are both warm. A loss therefore always carries `−`, a ▼ and a word ("lost", "needs"), and a gain carries `+`.

## Typography

**One family: the platform monospace.** No web fonts, which helps the 2 MB budget. Every glyph sits on the same width, so the interface can be laid out in a **36-column grid**: at 360 px wide and 14 px text there are about 38 columns, and 36 leaves margin. Boxes, meters and aligned tables all depend on this grid.

| Role | Size / weight | Use |
|---|---|---|
| `display` | 24 / 700, +0.1em | Sheet headlines (DEFEAT, VICTORY), phase name in the reveal |
| `title` | 20 / 700, +0.08em | Phase name on NEST, tab headings |
| `value` | 15 / 700 | Every changing number, primary button labels |
| `body` | 14 / 400 | Card text, sheet text |
| `meta` | 12 / 400 | Event lines, cost lines, guard conditions, tab labels |
| `label` | 11 / 400 | Resource-strip labels only (non-interactive) |

- Interface copy is UPPER CASE (terminal register). Event-log lines are upper case too. The cost line under a button uses sentence case so it reads as an aside ("3 of 3 out · back in 14m").
- Numbers use tabular figures with a space as the thousands separator up to 999 999, then short-scale suffixes (`88.2K`, `1.2M`, `3.4B`). No scientific notation before Transcendence (GDD).
- Interactive text is never below 12 px. Text scales with the OS setting. If the strip runs out of room, labels drop first and glyphs stay.

## Layout & Spacing

4 px base scale (4 / 8 / 12 / 16 / 24 / 32). Mobile margin is `{spacing.margin-mobile}`.

**Portrait mobile skeleton (360×640 minimum):**

```
┌────────────────────────────────────┐ safe-area top
│ ◊FOOD  ⌘WRK  ▭WOOD  △STON  ✺NECT   │ resource strip (56)
│ 1 240   37    212    96     41     │
├────────────────────────────────────┤
│ COLONY                             │ phase line
│ COMBAT AT 50 WORKERS + 1 GUARD     │
│ [██████████████████······]  74%    │ guard meter
│                                    │
│      ( vector nest scene )         │ tab content (scrolls)
│                                    │
│ > THE FIRST GUARD IS READY…        │ newest event
│ · BEETLES TOOK 3 FORAGERS.         │
│ ┌────────────────────────────────┐ │ thumb zone (40 %)
│ │ > BUY WAREHOUSE LV.3 █         │ │ primary action, pinned
│ └────────────────────────────────┘ │
│       400 ◊ · 40 ▭                 │
├────────────────────────────────────┤
│ [NEST]  WRKR  BUILD  FRONT  LOG    │ tab bar (52)
└────────────────────────────────────┘ safe-area bottom
```

- The vector scene spans the full content width and has no box around it. Text panels sit in `line`-bordered boxes.
- Single column. Only the map and star map pan.
- **Desktop (≥ 1024 px):** the same screens side by side. The NEST stays in column 1 and the active tab fills columns 2–3. The tab bar moves to a left rail. Content is at most 1280 px wide. The 36-column rule applies per column.

## Elevation & Depth

Terminals are flat. Depth comes from three layers:

1. **Screen:** `bg`, with the vector scene and text.
2. **Sheet:** `bg` with a 1.5 px `accent` top border, over the `{colors.scrim}`. Sheets never stack.
3. **Full-screen overlays:** the phase reveal, the title cinematic and the Transcendence ending.

**Glow** is the only depth cue: `{vector.glow}` on vector line-work and a soft text-shadow on accent text. The primary button and the newest event carry slightly more glow than the rest. **Scanlines** (`{vector.scanlines}`) sit over everything. Both are switched off by reduced motion and by a "CRT effects" setting.

## Shapes

- **The interface is square.** Buttons, cards, sheets and meters all use `{rounded.none}`. Borders are drawn as rules, or in text with box-drawing characters (`┌─┐│└┘`) when a panel is laid out on the grid.
- **The scene is organic.** Tunnels are smooth curves with round caps, chambers are irregular ellipses, soil has wavy strata. Nothing in the world is a perfect rectangle except map tiles, which are a deliberate grid.
- The only rounding is the device corner (`{rounded.phone}`), which the OS supplies.

## Components

Visual specs only. Behaviour lives in EXPERIENCE.md → Component Patterns. Visual references: [`mockups/title-cinematic.html`](mockups/title-cinematic.html), [`mockups/terminal-variants.html`](mockups/terminal-variants.html) (the vector nest and map frames), [`mockups/glyphs.html`](mockups/glyphs.html). Where a mock and this spine disagree, the spine wins.

- **Resource strip:** up to 5 cells. Each cell is a glyph plus a 4-letter `label` on one line, the `value` under it, and a `meta` delta under that (`+18/s` in `dim`, negatives in `warn`). A capped value turns `warn` and gains a `▲`. A 1 px `line` rule sits below the strip.
- **Glyphs:** 24×24 line icons with a `{vector.glyph-stroke}` stroke, round caps and `currentColor`, so they take the phase accent. They appear at 15 px in the strip, 13–14 px inline in cost lines, 18–22 px on cards and 30 px in the resource sheet. There are 20 glyphs (14 resources, 6 buildings); see `mockups/glyphs.html`. **To fix before E8:** FOOD and VNOM are both drop-shaped, so redraw VNOM as a fang or a vial.
- **Tab bar:** text only, in `meta`. The active tab is `[NAME]` in `accent`, bold. Inactive tabs are in `dim`. A tab with something newly affordable shows a `•` in `accent` beside its name. There are no badges with numbers.
- **Primary button:** transparent with a 1.5 px `accent` border, the label in `value` prefixed with `> `, and a blinking block cursor `█` after it. Disabled: 40 % opacity, with the reason on the cost line below in `meta`.
- **Secondary action:** `dim` text, no border, at least 44 px tall (CLOSE, IGNORE).
- **Stepper:** `[−]` `value` `[+]`, each bracket a 44 px target. A multiplier row above it reads `[ ×1 ]  ×10  ×MAX`, with the active one bracketed.
- **Role row (WRKR):** a 44 px row with the role name, a text bar (`█` per worker, `·` for empty, up to 16 cells and then scaled), the count, and the stepper.
- **Card** (building, research, mutation, enemy): a 1 px `line` border on `bg` with no fill. Title line: glyph + NAME in `body` bold + level change. Then an effect line in `meta`/`dim`, a cost line with inline glyphs (shortfall in `warn`: "needs 60 more △"), and the action button. A newly affordable card gets an `accent` border and glow for 2 s.
- **Meter:** typed in text, `[████████······]  74%`, in `meta`. Guard conditions sit underneath, one per condition, aligned left and right, with `✓` or `✗`. Entropy uses the same meter with the fill in `warn` above 75 %.
- **Bottom sheet:** `bg` with an `accent` top rule and a `────` handle. Headline in `display`, body in `body`, at most two actions (primary button and secondary action). A decision event with a timer shows it as a meter under the headline, plus an `IGNORE: …` line stating the outcome.
- **Event line:** `meta`. The newest line starts with `> ` in `accent`; older lines start with `· ` in `dim`. The NEST shows the newest 3.
- **Nest scene** (vector): soil is an `accent` fill at 7 %, a grain pattern at about 30 %, faint wavy strata, a few pebble outlines, and a grass line at the surface. Tunnels are round-capped strokes in `bg` over a slightly wider stroke in `accent` at 55 %, which reads as carved walls. Chambers are `bg` ellipses with a 2 px `accent` wall at 55 %. Creatures are solid `accent`: the queen (abdomen, thorax, head, six legs, antennae, about 40 px long), workers (three segments, about 9 px), eggs (an outlined oval), larvae (a thick curl). Above about 300 workers in one chamber, extra workers render as a dense cloud of 1–1.5 px dots with varying opacity. The count stays exact in text.
- **Map tile** (vector, 8×8): 40 px squares with 1 px gaps. Terrain is a single line glyph per type (forest ▲, meadow strokes, rock ridge, water wave, rival nest mound in `warn`). Unknown tiles show a dim `?`. Claimed tiles get an 18 % fill and a full-opacity stroke. The selected tile gets a 2.5 px `highlight` stroke.
- **Star map** (vector): a dim starfield, planets as outlined circles with a 30 % fill, dashed routes from HOME, the planet name in `meta` bold above and its resource in `label` below, and the ship as a small `highlight` arrow. Locked planets are at 35 % opacity.
- **Phase reveal:** full screen. The old palette cross-fades to the new one over 3 s, the phase name appears in `display` and one event line types in. Phase-specific: entering Combat is also where the first enemy creature is drawn.
- **Title cinematic:** first launch only, Phase 1 amber only. See `mockups/title-cinematic.html` and EXPERIENCE.md → Key Flows.
- **Transcendence ending:** the vector colony breaks apart into monospace characters, the characters scatter, and the screen empties to `bg`. One line of text remains.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Use only the runtime aliases in components | Hard-code a phase hex anywhere outside the theme table |
| Draw the world in vector, type the interface in mono | Mix the two (no ASCII ants, no vector buttons) |
| Use glyphs only inside text: strip, costs, cards | Use glyphs as standalone pictures or decoration |
| Keep one accent per phase | Show a later phase's colour early, the title included |
| Lay text panels out on the 36-column grid | Rely on box-drawing alignment past 36 columns |
| Pair every loss with `−`, ▼ or a word | Signal gain or loss with colour alone |
| Keep the exact integer next to every drawn population | Let the drawing replace the number |
| Make glow and scanlines optional | Use flashing or pulsing beyond the 1 s cursor blink |
| Use emoji nowhere | Ship emoji anywhere, placeholders included |
