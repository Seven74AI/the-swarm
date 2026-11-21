---
name: THE SWARM
description: Mobile-first ant-colony idle game. Vector scene, terminal UI. One phosphor color per phase on near-black.
title: "THE SWARM — DESIGN"
status: final
created: 2026-11-20
updated: 2026-11-20
sources:
  - _bmad-output/planning-artifacts/gdds/gdd-the-swarm-2026-11-20/gdd.md
  - _bmad-output/planning-artifacts/gdds/gdd-the-swarm-2026-11-20/epics.md
  - _bmad-output/planning-artifacts/gdds/gdd-the-swarm-2026-11-20/decision-log.md
  - _bmad-output/planning-artifacts/briefs/brief-the-swarm-2026-11-20/brief.md
colors:
  # Per phase: bg (near-black), raised (accent 8% into bg), line (25%, decorative rules only),
  # edge (≥ 3:1 on bg, interactive outlines), dim (≥ 5.3:1 on raised), accent, warn (accent lightened toward white).
  egg-bg: '#0d0a04'
  egg-raised: '#201704'
  egg-line: '#4a3403'
  egg-edge: '#7c5602'
  egg-dim: '#bb8201'
  egg-accent: '#ffb000'
  egg-warn: '#ffdb8c'
  colony-bg: '#0b0d08'
  colony-raised: '#1a2014'
  colony-line: '#3a482e'
  colony-edge: '#516440'
  colony-dim: '#7e9c65'
  colony-accent: '#c8f7a0'
  colony-warn: '#e6fbd4'
  combat-bg: '#0f0807'
  combat-raised: '#22110e'
  combat-line: '#4b241c'
  combat-edge: '#934736'
  combat-dim: '#db694f'
  combat-accent: '#ff7a5c'
  combat-warn: '#ffc4b7'
  expansion-bg: '#060d09'
  expansion-raised: '#102016'
  expansion-line: '#244a33'
  expansion-edge: '#336948'
  expansion-dim: '#4fa16f'
  expansion-accent: '#7dffb0'
  expansion-warn: '#c4ffdb'
  space-bg: '#050a0f'
  space-raised: '#0e1a22'
  space-line: '#223d4b'
  space-edge: '#376276'
  space-dim: '#5595b2'
  space-accent: '#7ad7ff'
  space-warn: '#c3edff'
  transcendence-bg: '#000000'
  transcendence-raised: '#141414'
  transcendence-line: '#404040'
  transcendence-edge: '#5c5c5c'
  transcendence-dim: '#8a8a8a'
  transcendence-accent: '#ffffff'
  transcendence-warn: '#ffffff'
  scrim: '#000000b3'
  # Runtime aliases. The active phase binds these; components reference only aliases.
  bg: '{colors.egg-bg}'
  raised: '{colors.egg-raised}'
  line: '{colors.egg-line}'
  edge: '{colors.egg-edge}'
  dim: '{colors.egg-dim}'
  accent: '{colors.egg-accent}'
  warn: '{colors.egg-warn}'
  on-accent: '{colors.egg-bg}'
typography:
  # One shipped subset monospace web font (WOFF2, regular + bold, ~15–25 KB). System monospace is fallback only.
  # Sizes are authored in px for readability here and implemented in rem (1rem = 16px) so OS/browser text scaling applies.
  display:
    fontFamily: '"Swarm Mono", ui-monospace, Menlo, Consolas, monospace'
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: 0.1em
  title:
    fontFamily: '"Swarm Mono", ui-monospace, Menlo, Consolas, monospace'
    fontSize: 20px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: 0.08em
  value:
    fontFamily: '"Swarm Mono", ui-monospace, Menlo, Consolas, monospace'
    fontSize: 15px
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: '"Swarm Mono", ui-monospace, Menlo, Consolas, monospace'
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.3
  aside:
    fontFamily: '"Swarm Mono", ui-monospace, Menlo, Consolas, monospace'
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.3
  meta:
    fontFamily: '"Swarm Mono", ui-monospace, Menlo, Consolas, monospace'
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.3
rounded:
  none: 0px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 24px
  '6': 32px
  hit-min: 44px
  margin-mobile: 14px
  margin-narrow: 8px
  strip-min-height: 56px
  tab-bar-height: 52px
  primary-zone: 64px
  map-tile: 40px
  map-gap: 2px
  peek-sheet-max: 160px
  glyph: 24px
  stroke: 1.2px
  stroke-strong: 1.6px
components:
  resource-strip:
    background: '{colors.bg}'
    rule: '{colors.line}'
    minHeight: '{spacing.strip-min-height}'
    glyphSize: 15px
    labelFont: '{typography.meta}'
    valueFont: '{typography.value}'
    deltaFont: '{typography.meta}'
  tab-bar:
    background: '{colors.bg}'
    rule: '{colors.line}'
    height: '{spacing.tab-bar-height}'
    activeBackground: '{colors.accent}'
    activeText: '{colors.on-accent}'
    inactiveText: '{colors.dim}'
    font: '{typography.meta}'
  primary-action:
    border: '{colors.accent}'
    borderWidth: 1.5px
    text: '{colors.accent}'
    pressedBackground: '{colors.accent}'
    pressedText: '{colors.on-accent}'
    font: '{typography.value}'
    minHeight: 50px
    rounded: '{rounded.none}'
  secondary-action:
    text: '{colors.dim}'
    font: '{typography.aside}'
    minHeight: '{spacing.hit-min}'
  disabled:
    text: '{colors.dim}'
    border: '{colors.edge}'
    borderStyle: dashed
  focus:
    outline: '{colors.accent}'
    outlineWidth: 2px
    outlineOffset: 2px
  stepper:
    buttonSize: '{spacing.hit-min}'
    valueFont: '{typography.value}'
  card:
    border: '{colors.line}'
    background: transparent
    selectedBackground: '{colors.raised}'
    affordableBorder: '{colors.accent}'
    padding: '{spacing.3}'
  meter:
    font: '{typography.meta}'
    fill: '{colors.accent}'
    empty: '{colors.edge}'
  bottom-sheet:
    background: '{colors.raised}'
    topRule: '{colors.accent}'
    topRuleWidth: 1.5px
    scrim: '{colors.scrim}'
  peek-sheet:
    background: '{colors.raised}'
    topRule: '{colors.accent}'
    maxHeight: '{spacing.peek-sheet-max}'
  event-line:
    font: '{typography.meta}'
    text: '{colors.dim}'
    newestText: '{colors.accent}'
  toast:
    background: '{colors.raised}'
    border: '{colors.accent}'
    font: '{typography.aside}'
  nest-scene:
    soilFill: '{colors.accent}'
    soilFillOpacity: 0.07
    grainOpacity: 0.3
    wallStroke: '{colors.accent}'
    wallOpacity: 0.55
    carved: '{colors.bg}'
    creatureFill: '{colors.accent}'
    workerMinLength: 12px
    labelFont: '{typography.meta}'
  map-tile:
    size: '{spacing.map-tile}'
    gap: '{spacing.map-gap}'
    stroke: '{colors.edge}'
    claimedFill: '{colors.raised}'
    claimedStroke: '{colors.accent}'
    selectedBackground: '{colors.accent}'
    selectedGlyph: '{colors.on-accent}'
    enemyNest: '{colors.warn}'
  glyph:
    grid: '{spacing.glyph}'
    stroke: '{spacing.stroke-strong}'
    color: currentColor
---

# DESIGN.md — THE SWARM

## Brand & Style

**Vector scene, terminal UI.** The colony and its world are drawn as glowing vector line-work: soil, tunnels, chambers, ants, enemies, the surface map, planets. Everything you read or press is a terminal: monospace text, bracketed buttons, block meters, boxed panels. Both are drawn in one phosphor color per phase on near-black. It's an old monochrome monitor showing a living ant farm.

Four rules carry the identity:

1. **One color per phase.** Each phase is a single phosphor family: `accent` plus its own dim, edge and warn tints. Entering a phase repaints everything at once, and that repaint is the reveal (GDD: "the reveal is the reward"). No color, name or picture from a later phase appears before that phase is reached. That covers the title cinematic and the goal meter too.
2. **The world is drawn and the interface is typed.** If it exists in the colony's world, it's vector. If it's information or a control, it's monospace text. Glyph icons are the one bridge: small vector marks that sit inside the text.
3. **Ants, not stats.** The nest scene shows the colony as countable creatures. The exact integer always sits next to it in text.
4. **Quiet chrome, loud moments.** Panels and labels are dim and still. Glow, motion and full accent are saved for what just changed and for what to press.

Not: emoji, gradients, rounded "app" cards, confetti, numeric badges, or any color outside the current phase's family.

## Colors

Every phase defines seven values; `on-accent` reuses the phase's `bg`. The front matter wins over this table on any conflict. Components use only the aliases (`bg`, `raised`, `line`, `edge`, `dim`, `accent`, `warn`, `on-accent`), so a phase change rebinds them and nothing else.

| Phase | `bg` | `accent` | `dim` | `warn` | Register |
|---|---|---|---|---|---|
| 1 Egg Laying | `#0d0a04` | `#ffb000` amber | `#bb8201` | `#ffdb8c` | One lamp in the brood chamber |
| 2 Colony | `#0b0d08` | `#c8f7a0` phosphor green | `#7e9c65` | `#e6fbd4` | The classic terminal; the nest is alive |
| 3 Combat | `#0f0807` | `#ff7a5c` alarm red-orange | `#db694f` | `#ffc3b6` | First threat |
| 4 Expansion | `#060d09` | `#7dffb0` mint | `#4fa16f` | `#c4ffdb` | The world above |
| 5 Space | `#050a0f` | `#7ad7ff` cyan | `#5595b2` | `#c3edff` | Cold, off-planet |
| 6 Transcendence | `#000000` | `#ffffff` white | `#8a8a8a` | `#ffffff` | The color drains out |

- **`accent`:** values, active controls, the newest event line, creatures, and scene walls at reduced opacity.
- **`dim`:** labels, older event lines, inactive tabs, cost lines, disabled labels. Never a value you act on.
- **`line`:** decorative rules and card borders. Never text, and never the only boundary of a control.
- **`edge`:** outlines that identify interactive or meaningful shapes: unclaimed map tiles, empty meter cells, the dashed border of a disabled button.
- **`raised`:** sheet backgrounds, the selected card, claimed map tiles.
- **`warn`:** negative deltas, shortfalls ("needs 60 more"), enemy nests. It is the phase's own accent pushed toward white, so it stays in the family. It is always paired with a non-color signal (see below).
- **Selection** (selected map tile, active tab, pressed button) uses **inverse video**: an `accent` fill with `on-accent` text or glyph. It adds no color.

**Contrast (measured, WCAG 2.x, with effects at their default):**

| Pair | Range across phases |
|---|---|
| `accent` / `bg` | 7.7–21:1 |
| `accent` / `raised` | ≥ 7.0:1 |
| `dim` / `bg` | 5.8–6.4:1 |
| `dim` / `raised` | ≥ 5.3:1 |
| `warn` / `bg` | ≥ 13:1 |
| `on-accent` / `accent` | ≥ 7.7:1 |
| `edge` / `bg` (non-text) | ≥ 3.0:1 |
| focus outline (`accent`) / `bg` | ≥ 7.7:1 |

The default CRT setting keeps scanlines off text (see Elevation & Depth), so these figures hold as rendered. A unit test recomputes this table from the tokens, so the claims can't drift.

**Hue is never the only signal.** `warn` sits close to `accent` in every phase (contrast between them is 1.1–1.7:1), so meaning comes from `−`, ▼, a word or an underline, never from the tint alone. In Transcendence `warn` equals the accent, so ▼ and an underline carry warnings there.

## Typography

**One shipped monospace font** ("Swarm Mono": a subset of an OFL font such as JetBrains Mono or IBM Plex Mono, chosen during the architecture work or in E8). It covers ASCII, box-drawing, block elements and the symbols `· − × ✓ ✗ ▲ ▼ • █ ░ ▒ ▓` in regular and bold, as about 15–25 KB of WOFF2. System monospace is only a fallback, because phone system fonts render some of these symbols wider and break the grid.

| Role | Size / weight | Use |
|---|---|---|
| `display` | 24 / 700, +0.1em | Sheet headlines (DEFEAT, VICTORY), the phase name in the reveal |
| `title` | 20 / 700, +0.08em | Phase name on NEST, tab headings |
| `value` | 15 / 700 | Changing numbers in the strip, buttons and sheets |
| `body` | 14 / 400 | Card and sheet text; values inside grid rows (bold) |
| `aside` | 13 / 400 | Cost lines, secondary actions, toasts (sentence case) |
| `meta` | 12 / 400 | Event lines, goal conditions, tab labels, strip labels and deltas |

- Sizes are written in px and implemented in **rem**, so the browser text size applies. The viewport never disables zoom.
- Rules: no text below 12 px; no sentence-case text below 13 px. Glow on text only at 15 px and above.
- Interface copy is UPPER CASE (terminal register), set as real capitals so screen readers read words. Cost and aside lines use sentence case.
- **Number formatting:** in the strip, full digits from 0 to 9 999, then 5-character suffixes (`12.4K`, `124K`, `1.24M`). Everywhere else (cards, sheets, the resource sheet), full digits with space grouping up to 999 999, then suffixes. No scientific notation before Transcendence (GDD). Figures are tabular.

## Layout & Spacing

The base scale is 4 px (4 / 8 / 12 / 16 / 24 / 32). The mobile margin is `{spacing.margin-mobile}`, dropping to `{spacing.margin-narrow}` below 360 px of viewport width.

**Minimum viewport: 360×512 CSS px** (a 640 px device minus browser chrome). **Reflow floor: 320 px.**

**Character grid.** Text panels are laid out on a monospace grid whose column count is computed: `cols = floor(contentWidth / advanceWidth(body))`. The design target is 36 columns. The grid is a layout aid and never a reason to clip text.

| Available columns | Behavior |
|---|---|
| ≥ 36 | As designed: box-drawn panels, aligned rows, full meters |
| 28–35 | Meters shrink to `cols − 8` cells; two-column condition rows stack |
| < 28 (large text or narrow viewport) | Box-drawing gives way to 1 px CSS borders in `line`; text wraps; meters become `74 % ████····` sized to fit; aligned tables become label-over-value stacks |

**Portrait skeleton (≥ 36 columns):**

```
┌────────────────────────────────────┐ safe-area top
│ ◊FOOD  ⌘WRKR ▭WOOD  △STON  ✺NECT   │ resource strip (min 56, grows)
│ 1 240   37    212    96     41     │
├────────────────────────────────────┤
│ COLONY                             │ phase line
│ NEXT: 50 WORKERS + 1 GUARD         │ goal meter
│ [██████████████████······]  74%    │
│      ( vector nest scene, flex )   │ clamp(120px, remaining, 220px)
│ > THE FIRST GUARD IS READY…        │ event lines: 3, or 1 below 560 px
├────────────────────────────────────┤
│ > BUY WAREHOUSE LV.3 █             │ primary zone (64), pinned
├────────────────────────────────────┤
│ NEST  WRKR  BUILD  FRONT  LOG      │ tab bar (52), active = inverse
└────────────────────────────────────┘ safe-area bottom
```

(The glyphs in the skeleton stand in for the vector glyphs.)

- **Thumb reach:** the primary action, the tab bar and the active sheet's actions always sit in the bottom 40% (`100dvh`). Scrolling content (role rows, cards) may sit higher, and every row can be scrolled down into that zone, because scroll areas have bottom padding equal to the height of the primary zone plus the tab bar.
- Single column. Only the map and the star map pan.
- **Landscape:** never blocked or locked. Content scrolls, and the primary zone un-pins below 480 px of viewport height.
- **Desktop (≥ 1024 px):** a left text rail (Components → Desktop left rail) replaces the tab bar. NEST stays in column 1 and the active tab fills columns 2–3; each column ends in its own primary zone. Sheets become centered dialogs (max 480 px). Content is at most 1280 px wide. The grid rule applies per column.

## Elevation & Depth

Terminals are flat. Depth comes from three layers:

1. **Screen:** `bg`, the vector scene and text.
2. **Sheets:** `raised` with a 1.5 px `accent` top rule. Modal sheets sit over `{colors.scrim}`. Peek sheets (map tile, planet) have no scrim. Sheets never stack.
3. **Full-screen overlays:** the phase reveal, the title cinematic and the Transcendence ending.

**CRT effects** have three settings:

- **SCENE (default):** scanlines over the vector scene and the full-screen overlays only, never over text, the strip, the tab bar or sheets. Glow (a 3 px accent drop-shadow) on vector line-work. On accent text 15 px and larger, a text-shadow of at most 2 px at no more than 35% opacity.
- **FULL:** scanlines everywhere. The contrast table above doesn't hold in this mode, and the setting says so.
- **OFF:** no scanlines, no glow.

Scanlines are drawn in device pixels to avoid moiré on fractional-DPR screens. OFF is selected automatically when the OS asks for more contrast or reduced transparency, or when the text scale is above 130%.

## Shapes

- **The interface is square.** Buttons, cards, sheets and meters use `{rounded.none}`. Panels on the grid may use box-drawing characters (`┌─┐│└┘`); otherwise they use 1 px CSS borders.
- **The scene is organic.** Tunnels are smooth round-capped curves, chambers are irregular ellipses, soil has wavy strata. Map tiles are the one deliberate grid in the world.

## Components

Visual specs only. Behavior lives in EXPERIENCE.md → Component Patterns (its name map lists where names differ). Reference mockups: EXPERIENCE.md → Mockups. Mock colors and sizes are illustrative; the tokens in this file are normative.

### Chrome

- **Resource strip:** five equal cells (`repeat(5, 1fr)`), centered. Each cell has a glyph and a label of at most 4 letters (`meta`), the value (`value`, at most 5 characters, see number formatting) and the delta (`meta`, at most 5 characters, no `/s`; negatives in `warn` with `−`). A capped value turns `warn` with ▲. Height is min-content from 56 px. At text scales above about 125%: 3 cells (capped or falling resources first) plus a `+2 ▸` cell that opens the resource sheet.
- **Tab bar:** text in `meta`. The active tab is inverse video (an `accent` cell with `on-accent` text); inactive tabs are `dim`. A tab with something newly affordable shows `•` beside its name. At text scales above 130%, names switch to 4-letter forms (`NEST WRKR BLDG FRNT LOG`). No numeric badges.
- **Segment row** (FRONT): `WAR · MAP · STARS` in `meta`, the active segment inverse video, each segment a 44 px target.
- **Condensed goal meter** (tabs other than NEST): one 24 px line under the strip, `NEXT ████······ 74%` in `meta`.
- **Desktop left rail and dialog:** the rail is a 160 px text column with full tab names in `body`, number-key hints in `edge`, and the active tab in inverse video. Each column ends in its own primary zone ([`mockups/key-desktop.html`](mockups/key-desktop.html)). A dialog is a centered bottom-sheet body (max 480 px) with the same top rule.

### Controls

- **Primary action:** transparent with a 1.5 px `accent` border, the label in `value` prefixed with `> `, and a block cursor `█` after it. **Pressed:** inverse video, held from press until release. It doesn't toggle on each hold repeat. The cursor blinks at 1 Hz for at most 5 s after the last input, then holds steady. It is always steady under reduced motion or CRT OFF. If the label would wrap, it truncates the target name, never the verb, with an ellipsis. The cost line moves inside the button as a second `aside` line when the label would wrap **or** the viewport is under 560 px tall (the single rule for this).
- **Secondary action:** `dim` text in `aside`, no border, at least 44 px tall (CLOSE, IGNORE).
- **Disabled** (any button): label in `dim`, a 1 px dashed `edge` border, and the reason on the cost line. No opacity fade.
- **Focus indicator:** a 2 px `accent` outline at a 2 px offset on every focusable control. It doesn't rely on glow.
- **Stepper:** `[−]` value `[+]`, each bracket a 44 px target. Multiplier row above it: `×1  ×10  ×MAX`, the active one in inverse video.
- **Hold-to-confirm:** a square ring of block cells around the button fills clockwise over the hold duration. **Two-tap mode** (setting): the first tap re-labels the button `> TAP AGAIN TO PRESTIGE` in inverse video for 5 s.

### Rows, cards and meters

- **Role row** (WRKR): a 44 px row with the role name, a text bar (`█` per worker, `·` in `edge` for empty, up to 16 cells and then scaled), the count, and the stepper.
- **Upkeep readout** (top of WRKR): `UPKEEP 18 / PRODUCTION 21` in `meta`, with the net figure in `value`. A negative net is shown in `warn` with ▼.
- **Automation target row:** `KEEP [−] 20 [+] IN TRAINING` plus an `[AUTO]` toggle (inverse when on), 44 px tall. Appears under the verb it automates.
- **Card** (building, research, mutation, enemy, Click Power): 1 px `line` border, no fill (`raised` when selected). Title line: glyph, NAME in `body` bold, level change. Then an effect line (`meta`, `dim`), a cost line (`aside`, inline glyphs, shortfall in `warn`: "needs 60 more △") and the action. A newly affordable card gets an `accent` border and glow for 2 s.
- **Research card** additionally shows a progress meter and remaining time in `meta`. While running, its action becomes `CANCEL (50 % BACK)` as a secondary action that needs confirmation.
- **Meter:** `[████████······]  74%` in `meta`, with filled cells in `accent` and empty cells in `edge`. Condition rows sit underneath, one per condition, with the words `met` or `need` as well as ✓ or ✗. Entropy uses the same meter with a `warn` fill above 75%.
- **Event line:** `meta`. The newest line starts with `> ` in `accent`; older lines start with `· ` in `dim`.

### Sheets and overlays

- **Bottom sheet** (modal): `raised`, an `accent` top rule, a `────` handle, the headline in `display`, body text in `body`, and at most two actions. **Decision sheet:** a timer meter under the headline (when timed) plus the line `IGNORE: <outcome>` in `meta`.
- **Peek sheet** (tile, planet, chamber): `raised` with an `accent` top rule, at most 160 px tall, no scrim. Header names the target (`MEADOW · (5,3)`). At most two actions.
- **Resource sheet:** a modal sheet listing every unlocked resource as a 30 px glyph, the full name, the exact integer, its rate (with the unit stated once in the header), cap and source. A `[ SETTINGS ⚙ ]` text button sits at the bottom.
- **Toast:** one line in `aside` on `raised` with a 1 px `accent` border, above the primary zone.
- **Coach mark:** a 1 px `accent` box around the target, plus a one-line `body` caption on `raised` with a `[ GOT IT ]` secondary action.

### Vector and full-screen

- **Glyphs:** 24×24 line icons, `{spacing.stroke-strong}` stroke, round caps, `currentColor`. They appear at 15 px in the strip, 13–14 px inline in cost lines, 18–22 px on cards and 30 px in the resource sheet. There are 20 glyphs (14 resources, 6 buildings) plus a gear for settings. **Before E8:** redraw VNOM as a fang or vial (it currently reads like FOOD).
- **Nest scene** (vector): soil is an `accent` fill at 7%, a grain pattern at 30%, faint strata, a few pebble outlines and a grass line at the surface. Tunnels are round-capped `bg` strokes over a slightly wider `accent` stroke at 55% (carved walls). Chambers are `bg` ellipses with a 2 px wall. Creatures are solid `accent`: the queen (abdomen, thorax, head, six legs, antennae), workers, eggs (outlined oval), larvae (thick curl). **Camera scale:** 2× in Phase 1 (worker about 18 px, egg about 10 px), 1.5× from about 50 workers, 1× from about 150 `[ASSUMPTION: thresholds]`. A worker drawn individually is never under 12 px. **Cloud:** once drawn ants would cover more than about 15% of a chamber's area, the extras become a dot cloud (1–1.5 px dots at varying opacity) with 30–50 individual ants still moving on top. **Chamber labels** (with exact counts) are HTML text overlaid at chamber anchors in `meta`/`dim` on a `bg` plate, not SVG text.
- **Map tile** (vector, 8×8): 40 px squares with 2 px gaps and a 12 px screen margin. Unclaimed tiles have a 1 px `edge` stroke. Terrain uses the GDD types, one line glyph each: **Forest** (tree), **Meadow** (grass strokes), **Mountain** (ridge), **Empty** (a single dot), **Enemy Nest** (mound, in `warn`). Unknown tiles show `?` in `dim`. **Claimed:** `raised` fill with an `accent` stroke. **Selected:** inverse video (an `accent` fill with the glyph in `on-accent`).
- **Star map** (vector): a dim starfield, planets as outlined circles with a 30% fill, dashed routes from HOME, the planet name in `meta` bold above and its resource below, the ship as a small `accent` arrow. Locked planets are drawn in `edge`.
- **Phase reveal:** full screen. The old palette cross-fades to the new one over 3 s, the phase name appears in `display`, and one event line types in. The Combat reveal is where the first enemy creature is drawn.
- **Title cinematic:** first launch only, Phase 1 amber only. See the mockup and EXPERIENCE.md → Key Flows.
- **Transcendence ending:** the vector colony breaks apart into monospace characters, which scatter, and the screen empties to `bg`, leaving one line of text. Under reduced motion it is a 1 s fade.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Use only the runtime aliases in components | Hard-code a phase hex outside the theme table |
| Draw the world in vector, type the interface in mono | Mix the two (no ASCII ants, no vector buttons) |
| Use glyphs only inside text: strip, costs, cards, sheets | Use glyphs as standalone pictures or decoration |
| Keep every color inside the current phase's family | Show a later phase's color, name or picture early |
| Compute grid columns and reflow below 36 | Clip or overflow text to keep box-drawing aligned |
| Pair every loss with `−`, ▼ or a word | Signal gain or loss with tint alone |
| Keep the exact integer next to every drawn population | Let the drawing replace the number |
| Change any element's luminance at most 3 times in any 1 s | Re-invert a button on every hold repeat |
| Stop the cursor blink after 5 s idle, and always under reduced motion | Blink anything indefinitely |
| Keep scanlines off text by default | Put glow on text under 15 px |
| Use emoji nowhere | Ship emoji, placeholders included |
