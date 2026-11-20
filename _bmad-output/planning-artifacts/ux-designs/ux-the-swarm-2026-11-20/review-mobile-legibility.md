# Review: mobile legibility (DESIGN.md, EXPERIENCE.md, mockups/)

Reviewer lens: phone-first legibility and layout fit at 360×640 portrait, one-handed. Reviewed on 2026-11-20 against `DESIGN.md`, `EXPERIENCE.md`, `mockups/terminal-variants.html`, `mockups/glyphs.html` and `mockups/title-cinematic.html`.

Method: arithmetic from font metrics, plus headless Chrome (Playwright) renders of the mockups and of a synthetic strip and 36-column ruler built to the DESIGN.md tokens. Advance widths were measured on the installed DejaVu Sans Mono (the same metrics as Menlo and Bitstream Vera) and Liberation Mono (the same metrics as Courier New, and the same 0.600 em advance as SF Mono, Roboto Mono and Droid Sans Mono). Advances for SF Mono, Roboto Mono, Droid Sans Mono and Consolas come from their published metrics; those fonts are not installed here. Contrast is WCAG 2.x relative luminance.

## Verdict

**Fits at 100 % text on a 360 px viewport, with almost no headroom. It breaks under real-world conditions the spec explicitly promises to support.**

The style holds up well at the default size: the NEST frame at 360 px reads cleanly, and the vector map and the dot cloud work. But the 36-column grid, the 5-cell strip and the vertical stack are all tuned to exactly 360×640 at 100 % text:

- The grid overflows at **110 %** OS text, or at any viewport narrower than about **352 px**.
- The strip overflows at about **130 %** text, and immediately with the spec's own `999 999` number format.
- 640 px is a device height, but the usable browser viewport on such a device is about **510–560 px**.

The spec says text "follows the OS up to 200 % without clipping controls", and the only rule it gives for that case is "labels drop first". That rule doesn't free the width that is actually short. One finding is critical, and most of the others are fixable with rules rather than redesign.

**Counts:** 1 critical, 6 high, 8 medium, 6 low.

---

## Reference measurements

### A. Does 36 columns fit? (content width = viewport − 2 × 14 px margin)

| Font (platform) | Reached by the stack? | Advance (em) | 36 cols @14 px | 36 cols @15 px | Columns in 332 px @14 |
|---|---|---|---|---|---|
| SF Mono (iOS, macOS Safari) | Only through `ui-monospace`, which only Safari supports. Chrome on macOS cannot name SF Mono and gets Menlo | 0.600 | 302.4 | 324.0 | 39.5 |
| Menlo (macOS Chrome/Firefox) | yes | 0.602 | **303.4 measured** | **325.1 measured** | 39.4 |
| Roboto Mono | Rarely: it is **not** a system font on Android | 0.600 | 302.4 | 324.0 | 39.5 |
| Droid Sans Mono (Android `monospace`) | yes, through the generic `monospace` (what Android actually gets) | 0.600 | 302.4 | 324.0 | 39.5 |
| Consolas (Windows) | yes | 0.550 | 277.1 | 296.9 | 43.1 |
| DejaVu / Liberation Mono (Linux, ChromeOS) | through the generic | 0.602 / 0.600 | 303.4 / 302.5 measured | 325.1 / 324.1 measured | 39.4 / 39.5 |

Slack at 360 px and 100 %: about 29 px at 14 px text, and about **7 px** at 15 px.

### B. 36 columns under text scaling and narrow viewports (14 px body, 0.6 em)

| OS text scale | Width of 36 cols | Columns that fit in 332 px (360 vp) | Columns that fit in 292 px (320 vp) |
|---|---|---|---|
| 100 % | 302 px | 39.5 | **34.8 ✗** |
| 110 % | **333.6 px (measured)** | **35.9 ✗** | 31.6 ✗ |
| 130 % | 393 px | 30.4 ✗ | 26.7 ✗ |
| 150 % | 455 px (measured) | 26.3 ✗ | 23.2 ✗ |
| 200 % | 607 px (measured) | 19.8 ✗ | 17.4 ✗ |

At 15 px (`value`) the grid breaks at 103 %. At 12 px (`meta`) it holds to about 128 %. At 11 px (`label`) it holds to about 139 %.

### C. Resource strip, measured (glyph 15 + 4-letter `label` 11 / `value` 15 bold / `meta` 12 delta)

Widths are the sum of the cell contents, with no gaps. Available width is 332 px at a 360 px viewport and 292 px at 320 px. Five cells need at least about 24 px of total gap to stay readable as five things.

| Content | 100 % | 110 % | 130 % | 150 % | 200 % |
|---|---|---|---|---|---|
| Typical (`1 240` `37` `212`, `+18/s`) | 219 | 240 | 282 | 325 (320 vp ✗) | **430 ✗** |
| Suffixed (`88.2K` `12.4K` `1.2M`, `+410/s`, `+1.1K/s`) | 228 | 250 | 295 (320 vp ✗) | **340 ✗** | **452 ✗** |
| Spec format, 7 chars (`999 999` ×5) | **316 (+24 gap = 340 ✗)** | **348 ✗** | 411 ✗ | 474 ✗ | 632 ✗ |

Strip height: the content alone is 49 px at 100 % and 97 px at 200 %. The mockup strip renders at **69 px** (glyph version: 69.8), not the specified 56.

### D. Vertical budget on NEST (rendered mockup, 360 px wide)

| Block | Height |
|---|---|
| Strip | 69 (spec 56; about 57 is the real minimum) |
| Phase line, guard, meter, condition row | 94 |
| Nest scene (SVG 336×200) | 206 |
| 3 event lines | about 82 |
| Primary button and cost line | 89 |
| Tab bar | 53 |
| **Total** | **≈ 593** (≈ 580 with a 56 px strip) |

Real viewports: about 512 px on a 360×640 Android in Chrome (24 px status bar, 56 px URL bar, 48 px nav bar). About 548 px on an iPhone SE 2/3 in Safari. About 568 px as an installed PWA. The mockups are drawn on a **720 px** tall phone.

### E. Contrast after effects (dim token on bg)

| Phase | dim/bg (spec) | dim on a scanline row (−18 %) | dim vs. a 20 % accent halo | Mockup "dim" (62 % mix) |
|---|---|---|---|---|
| Egg | 5.14 | **3.72** | **3.52** | 4.63 |
| Colony | 5.49 | **3.96** | **3.28** | 6.52 |
| Combat | 5.03 | **3.64** | **3.75** | **3.54** |
| Expansion | 5.40 | **3.90** | **3.27** | 6.38 |
| Space | 5.28 | **3.81** | **3.49** | 5.15 |
| Transcendence | 5.32 | **3.82** | **3.20** | 7.85 |

The spec's own contrast claims check out (dim/bg 5.03–5.49, dim/raised 4.61–4.69, accent/bg 7.74–21). The effects are what pull them below AA.

---

## Findings

### 1. **[critical]** The 36-column grid has no headroom, and the spec promises 200 % text with no reflow rule

*Location:* DESIGN.md → Typography ("36-column grid … 36 leaves margin"; "Text scales with the OS"); DESIGN.md → Do's and Don'ts ("Lay text panels out on the 36-column grid"); EXPERIENCE.md → Accessibility Floor ("follows the OS up to 200 % without clipping controls").

**Evidence:**

- Tables A and B. At 360 px, 36 columns of 14 px text fit with 29 px of slack at 100 %. At **110 %** the grid needs 333.6 px (measured) of the 332 px available.
- At a 320 px viewport the grid already fails at 100 % (302 px needed, 292 available).
- At 200 % only about 20 columns fit, so every box-drawn panel (`┌──┐`), every fixed 24-cell meter and every aligned table overflows or wraps mid-border.
- Many Android users run their font size above default, and Chrome on Android applies the OS font size to web pages. Depending on the Chrome version this happens as text scaling (px text grows) or as page zoom (the CSS viewport shrinks, e.g. 360 / 1.3 ≈ 277 px). Either way the player gets fewer than 36 columns.
- Small 360-dp phones with "Display size: Large" also report about 320 CSS px.
- The spec's only rule for this case ("labels drop first, glyphs stay") covers the strip alone.

*Fix:* Make the column count an output, not a constant. Define `cols = floor(contentWidth / (0.6 × bodySize))`, with 36 as the design target and 28 as the box-drawing floor. Add a reflow table to DESIGN.md:

- **≥ 36 cols:** as designed.
- **28–35 cols:** meters shrink to `cols − 8` cells, and two-column condition rows stack.
- **< 28 cols** (large text or narrow viewport): panels drop box-drawing characters for 1 px CSS borders in `line`, text wraps, meters become one line of `74 % ████····` with the cells sized to fit, and aligned tables become label-over-value stacks.

Also allow the margin to drop to 8 px below 360 px: 304 px then fits 36 columns at 14 px. State that the grid is a layout aid, never a reason to clip text.

### 2. **[high]** The resource strip overflows with the spec's own number format, and "labels drop first" doesn't free the width that's short

*Location:* DESIGN.md → Components → Resource strip, and Typography (number format "space as the thousands separator up to 999 999"). EXPERIENCE.md → Component Patterns → Resource strip, and Accessibility Floor.

**Evidence:**

- Table C. Five 7-character values (`999 999`) need 316 px of content plus gaps at **100 %**, against 332 px available. At a 320 px viewport they don't fit at all.
- Suffixed values (`88.2K`, `+410/s`, `+1.1K/s`) fit at 100 % (228 px) but overflow at about 133 % on 360 px and at 130 % on 320 px. At 200 % they need 452 px.
- The binding width is the **value** (5 chars × 9 px = 45 px at 15 px bold), not the label: glyph + gap + 4 letters at 11 px ≈ 45 px, so dropping labels saves height only.
- The mockups already contradict the number format: `12.4K` appears for a value the spec would print as `12 400`.
- The strip measures 69 px tall in both mockups, against the 56 px token. With the specified 12 px deltas and any padding it can't be 56: content alone is 49 px.

*Fix:*

- **Width budget for values:** at most 5 characters in the strip. Show `0`–`9 999` exact, then `12.4K` / `124K` / `1.24M` (switch to a suffix at 10 000, not 1 000 000). The exact integer lives in the resource sheet.
- **Width budget for deltas:** at most 5 characters. Drop `/s` in the strip (`+410`, `+1.1K`) and state the unit once in the resource sheet header.
- **Fixed cells:** five equal cells (`grid-template-columns: repeat(5, 1fr)`), values centred, so a value changing width at 4 Hz doesn't shove its neighbours.
- **Above about 125 % text:** show 3 cells plus a `+2 ▸` cell that opens the sheet (or wrap to a 3 + 2 two-row strip). Choose by priority: the resource that is capped or falling first.
- **Height:** make it `min-content` (token: min 56, grows with text). Hide the label row only for vertical room.

### 3. **[high]** The vertical budget assumes a 640 px viewport, but 640 is the device height

*Location:* EXPERIENCE.md → Foundation and frontmatter `form_factor` ("360×640 min"); DESIGN.md → Layout & Spacing (portrait skeleton) and Components (strip 56, tab bar 52); mockups (phone frame 720 px tall).

**Evidence:** Table D. The NEST stack needs about 580–593 px. A 360×640 Android in Chrome gives about 512 px, and an iPhone SE in Safari about 548. Rendered at 512 px (frame clipped as on a device), the tab bar is pushed off-screen and only 2 event lines remain. The pinned zone (strip + primary + tab bar ≈ 197 px) leaves about 315 px for content that needs about 382. On FRONT → MAP the mockup content is already **764 px** tall inside the 720 px frame (overflowing). At 640 it is about 748 px, so the map can't be shown with the pinned controls without scrolling.

*Fix:*

- Restate the minimum as a **viewport of 360×512** (the device sizes are just examples), and redraw one mockup frame at 360×512 and one at 360×640.
- Make the nest scene flexible: height `clamp(120px, 100% − fixed blocks, 220px)`, with no fixed 336:200 aspect, and crop rather than scale so ants keep their size.
- Below about 560 px of viewport height, show 1 event line, not 3 (LOG keeps the rest), and put the cost line inside the button as a second line.
- Size the pinned primary area to 64 px.
- Use `100dvh`, not `100vh`, for the thumb zone.

### 4. **[high]** Scanlines and glow drop small dim text below AA; the "CRT effects" default is unspecified, and the mockup glows every line of text

*Location:* DESIGN.md → Elevation & Depth (glow and scanlines "over everything"), `vector.scanlines`, `vector.glow`; EXPERIENCE.md → State Patterns → Settings (CRT effects has no default); `mockups/terminal-variants.html` and `glyphs.html` (`.phone { text-shadow: 0 0 5px accent 45 % }` inherited by all text, including dim).

**Evidence:**

- **Scanlines:** a 1 px band at 18 % black every 3 px darkens a third of every glyph's rows. On those rows dim/bg falls from 5.0–5.5 to **3.6–4.0:1** (table E). An 11 px capital is about 7.7 px tall, about 2.5 scanline periods, so a thin horizontal stroke (≈ 0.9 px at regular weight) on a dark band loses a fifth of its luminance.
- **Fractional DPRs:** on 2.625 and 2.75 devices (common on Android), a 1 CSS px line rasterises as alternating 2- and 3-device-px bands. That produces a visible beat pattern about every 8 CSS px, i.e. moiré across text.
- **Glow:** the spec limits the text-shadow to accent text, but the mockups give dim text an **accent-coloured** 5 px halo, brighter than the glyph itself. The local contrast of the glyph against its halo models at about 3.2–3.75:1, and a 5 px blur on 11–12 px text is about the size of the x-height (halation, worse for astigmatic eyes).
- The resource-strip crop at DPR 3 shows the effect: the dim labels are soft next to the values.

*Fix:*

- Make CRT effects tri-state: **SCENE** (default) / FULL / OFF.
- **SCENE:** scanlines over the vector scene layer and full-screen overlays only, never over text panels, the strip, the tab bar or sheets. Glow on vector line-work, plus a text-shadow ≤ 2 px blur at ≤ 35 % on **accent text ≥ 14 px only**. Never glow on `dim` text.
- **Scanline drawing:** draw scanlines in device pixels (period `3px` scaled by `1 / devicePixelRatio`, or on a canvas at native resolution) so fractional DPRs don't produce moiré.
- **Auto-select OFF** when `prefers-contrast: more`, when `prefers-reduced-transparency` is set, or when the effective text scale exceeds 130 %.
- Add a row to the DESIGN.md contrast statement: "Contrast is measured with effects on, at the scanline row."

### 5. **[high]** The platform monospace stack can't guarantee the grid glyphs; fallbacks are wider and break alignment

*Location:* DESIGN.md → Typography ("One family: the platform monospace. No web fonts"), `typography.mono.fontFamily`; DESIGN.md → Components → Meter (`█` `·`, `✓` `✗`), Shapes (`┌─┐│└┘`), Colors (`▼` `▲` `−`).

**Evidence:**

- `ui-monospace` only resolves in Safari. "SF Mono" is not exposed by name to Chrome or Firefox on macOS, so they get Menlo. "Roboto Mono" is not a stock Android font, so Android gets Droid Sans Mono through `monospace`. Each platform therefore has a different x-height, weight and glyph coverage.
- Measured: Liberation Mono, a standard Linux/ChromeOS mono, has no `✓` or `✗`. Chrome substitutes another font, and 10 × `✓` renders at **123.8 px instead of 84.0 px (+47 % per glyph)**. Any row that contains a check mark falls off the grid.
- The same risk applies to `─ │ ┌ █ ▲ ▼` in Droid Sans Mono. Its coverage of box-drawing and block elements is unverified and must be checked on a device before the grid depends on it.

*Fix:* Ship one subset web font: e.g. a DejaVu Sans Mono, JetBrains Mono or IBM Plex Mono subset of ASCII, `· − × ▲ ▼ ✓ ✗ █ ░` and the box-drawing set. That is about 15–25 KB as WOFF2 (regular + bold), about 1 % of the 2 MB budget. Set `font-display: block` for at most 300 ms, and keep the platform stack only as the fallback. It also gives every platform the same advance (no Consolas 0.55 vs 0.60 drift) and the same x-height under glow.

If the owner keeps "no web fonts", restrict grid-aligned rows to ASCII plus `─│┌┐└┘█·`, render `✓ ✗ ▲ ▼` as inline SVG glyphs in a fixed one-column box (`width: 1ch`), and add an E1 device test that measures `'✓'.width === 'A'.width`.

### 6. **[high]** "Every Phase 1–3 action reachable in the bottom 40 %" can't hold on WRKR or BUILD

*Location:* EXPERIENCE.md → Accessibility Floor ("One-handed: every Phase 1–3 action is reachable in the bottom 40 % (E1 done-when)"); DESIGN.md → `spacing.thumb-zone: 40vh`; EXPERIENCE.md → Tabs (WRKR role rows).

**Evidence:** The bottom 40 % of a 512 px viewport is 205 px. The tab bar (52) and pinned primary (89) use 141 of it, which leaves about 64 px: one 44 px row. WRKR has 6 role rows × 44 px = 264 px plus the multiplier row and upkeep line. BUILD has a scrolling list of cards. Most steppers therefore sit in the top 60 %. Because this is written as an E1 done-when, it will become an acceptance test that fails.

*Fix:* Reword it as: "The primary action, the tab bar and the active sheet's actions are in the bottom 40 %. Scrolling content may sit higher, as long as any row can be scrolled into the bottom 40 %." To make that true, give scrollable tabs bottom padding equal to the top region, so the first row can scroll down to the thumb zone. Better still, bottom-anchor WRKR: role rows stack upward from the pinned area, with the most-used role (GATHER) nearest the thumb.

### 7. **[high]** Map tiles: 40 px with 1 px gaps gives a high mis-tap rate; select-then-sheet is the right idea, but the sheet hides the map

*Location:* DESIGN.md → Components → Map tile, `spacing.map-tile`; EXPERIENCE.md → Component Patterns → Map tile ("fits without zoom"), Accessibility Floor → Targets; `terminal-variants.html` → "Frontier · Map (vector tiles)".

**Evidence:**

- **Width fits at 360 px:** 8 × 40 + 7 × 1 = 327 px, inside 332 (5 px spare). At 320 px the SVG scales to **35.2 px tiles** (measured), and nothing in the spec says whether tiles scale or the map pans.
- **Target size:** 40 CSS px ≈ 6.4 mm, against 44 pt ≈ 7.0 mm (Apple) and 48 dp ≈ 7.6 mm (Material), with 1 px between targets against the spec's own 8 px floor.
- **Error rate:** with a typical one-handed thumb touch scatter of σ ≈ 1.5–2 mm per axis, the estimated miss rate on a 6.4 mm target is about **6 % (σ 1.5) to 20 % (σ 2, on a bus)**.
- **The mitigation and its gap:** select-then-sheet makes a miss cost a re-tap instead of a wrong commit, which is the right approach. But at 512–640 px of viewport the map (327 px) plus strip, header, segment row and pinned controls already overflow, and a bottom sheet of about 200–250 px covers map rows 5–8. A player who mis-selected a lower tile can't see it and has to dismiss the sheet before re-tapping. The mockup's 1 px tile strokes at 30 % are 1.7–2.3:1 against `bg`, below the 3:1 non-text contrast for interactive boundaries, and the unknown-tile `?` at 45 % is 2.4–3.9:1.

*Fix:*

- Make the tile sheet a **non-modal peek sheet** (≤ 160 px, no scrim). Tapping another tile retargets it, swipe-down closes it, and the map stays interactive above it.
- When a tile is selected, auto-scroll so it sits at least 16 px above the sheet. The sheet header names the tile (`MEADOW · (5,3)`, as the mock already does) so a wrong selection is obvious.
- Use 2 px gaps (8 × 40 + 7 × 2 = 334: use a 12 px margin on the map screen) for visual separation.
- Raise the tile stroke to ≥ 45 % (≈ 3:1) and draw `?` in the `dim` token.
- Below 352 px of content width, keep tiles at 40 px and let the map pan horizontally, rather than shrinking them to 35 px.
- Hide or disable the pinned FRONT primary (`> SEND EXPEDITION`) while the tile sheet is open, so the bottom of the screen has one set of actions.

### 8. **[medium]** 15 px values can't share a grid row with 14 px body text

*Location:* DESIGN.md → Typography (`value` 15, `body` 14, 36-column grid); Components → Role row, Stepper, Card cost line.

**Evidence:** The grid cell at 14 px is 8.4 px. A 15 px value character is 9.0 px wide. A role row like `GATHER ████████····  12  [−] [+]` with the count in `value` drifts 0.6 px per value character, so columns stop lining up across rows. Bold doesn't change the advance, but size does.

*Fix:* Inside grid-aligned rows, render values at body size (14 px) in bold accent, or place each value in a fixed slot of `ceil(n × 9 / 8.4)` cells. Reserve 15 px for the strip, buttons and sheets, which are off the grid.

### 9. **[medium]** 11 px dim labels and 12 px dim meta sit below comfortable reading size at phone distance

*Location:* DESIGN.md → Typography (`label` 11, `meta` 12), Components → Resource strip (labels in dim), Event line, Card cost line (sentence case, 12 px, dim).

**Evidence:**

- An 11 px upper-case label has a cap height of about 7.7 px ≈ 1.2 mm on a phone. That subtends about 12′ at 35 cm and **about 7.5′ at 55 cm** (arm's length). Reading-research critical print size is about 12′ x-height. 5′ is the 20/20 acuity limit.
- The 12 px sentence-case cost line has an x-height of about 6.4 px ≈ 1.0 mm (≈ 6′ at 55 cm), and it carries the shortfall the player must act on.
- 11 pt (Apple caption 2) and 11 sp (Material label-small) are platform floors meant for full-contrast text, not 5:1 dim text under glow.

*Fix:*

- Raise `label` to 12 px.
- Set the rule "no `dim` text below 12 px, no sentence-case text below 13 px".
- Raise the cost line to 13 px, and draw the shortfall part (`needs 60 more △`) in `warn`, as specified.
- Keep 11 px only for the star-map resource label, and only if it is accent.

### 10. **[medium]** The 9 px worker reads as a dash; eggs and larvae at about 5 px are hard to tell apart in Phase 1

*Location:* DESIGN.md → Components → Nest scene ("workers (three segments, about 9 px)", eggs, larvae); Brand rule 3 "Ants, not stats"; `terminal-variants.html` → "Nest · Phase 2".

**Evidence:** The mockup worker is three blobs about 9.3 × 3 px with no legs. In renders at DPR 3, they read as short pills or dashes, not as ants. Eggs (outlined ovals) and larvae (curls) render at about 5–6 px, and telling them apart *is* the Phase 1 loop (eggs → larvae → workers).

*Fix:*

- Add a scene **camera scale**. In Phase 1 the brood chamber fills the scene at 2× (worker ≈ 18 px with 3 leg strokes per side, egg ≈ 10 px, larva ≈ 12 px).
- Pull the camera back as chambers are dug: 1.5× at about 50 workers, 1× at about 150. Each pull-back is a small, quiet reveal.
- Set a floor of 12 px for a worker drawn individually, with at least antennae or a leg hint.

### 11. **[medium]** A cloud threshold of 300 per chamber is too high for the chamber sizes drawn

*Location:* DESIGN.md → Components → Nest scene ("Above about 300 workers in one chamber … dense cloud"); EXPERIENCE.md → Component Patterns → Nest scene ("track the real counts up to the cloud threshold").

**Evidence:** The largest mockup chamber is about 280 × 85 px ≈ 18 500 px². A 9 × 3 px worker needs about 100 px² of clear space to read as one creature, so individual ants overlap into mush at about 150–180. At 300, the ants themselves cover about 44 % of the chamber before any spacing. Smaller chambers (brood, store) saturate at a few dozen. Nobody can count past about 30 at a glance anyway. Separately, 300 animated 3-node SVG groups per chamber, with a `drop-shadow` filter, is a jank risk on low-end Android (see finding 21).

*Fix:* Switch to the cloud **by density, not by count**: when drawn ants would cover more than about 15 % of a chamber's area (≈ 100–150 in the big chamber, fewer in small ones). Keep 30–50 animated individual ants on top of the dot cloud so the chamber still reads as alive. Cap individually drawn ants at about 150 across the whole scene.

### 12. **[medium]** Scene labels that carry the exact count are SVG text: they scale with the viewBox, ignore OS text size and collide with tunnels

*Location:* DESIGN.md → Brand rule 3 and Do's ("Keep the exact integer next to every drawn population"); `terminal-variants.html` (`<text font-size="11" fill-opacity=".62">WORKERS · 37</text>` inside the SVG).

**Evidence:** The chamber label holding the count is 11 px in viewBox units at 62 % opacity. At a 320 px viewport the SVG scales to 0.88, so the label becomes **≈ 9.7 px**. SVG text in a scaled viewBox doesn't follow OS text scaling. In the render, the `STORE` label is crossed by a tunnel stroke.

*Fix:* Render chamber labels as HTML text overlaid on the scene (absolutely positioned from the chamber anchors), in the `meta` token and `dim` colour, with a `bg` backing plate (padding 2 px) so strokes never cross them. Add to DESIGN.md: "Text inside the vector scene is never smaller than `meta` at any viewport."

### 13. **[medium]** The tab bar overflows at about 148 % text

*Location:* DESIGN.md → Components → Tab bar (text-only, `meta` 12, active `[NAME]` bold).

**Evidence:** Five tabs in 360 px leaves 72 px each. The active `[FRONT]` / `[BUILD]` is 7 chars × 7.2 px = 50 px at 100 %, which fits. It overflows the cell (minus 8 px padding) at **about 148 %**, and at 200 % needs 101 px.

*Fix:* Use 4-letter tab names at all times (`NEST WRKR BLDG FRNT LOG`, matching the strip's 4-letter register). Show the active state as inverse fill (`accent` background, `on-accent` text), not brackets, which saves 2 characters. Above 150 % let the bar grow to two text lines; never truncate.

### 14. **[medium]** Primary-button labels have no wrap rule

*Location:* DESIGN.md → Components → Primary button (`value` 15 bold, `> ` prefix, `█` cursor); EXPERIENCE.md → Primary action (label names action and target, e.g. "> BUY WAREHOUSE LV.3").

**Evidence:** The button's inner width is about 300 px, which holds 33 characters at 15 px (31 with the mockup's 0.04 em tracking). `> BUY WAREHOUSE LV.3 █` and `> CHANGE → MANDIBLES █` are 22 characters, so they wrap at about 145 %. At 200 % only about 16 characters fit. Longer auto-chosen targets ("> MOVE 4 TO GATHER", research names) will hit this sooner.

*Fix:* Allow at most 2 lines; the button grows (min-height 50). Drop the target's qualifier first (`LV.3`), then the target, and never the verb. Cap auto-generated labels at 24 characters in the content rules.

### 15. **[medium]** "Text scales with the OS" doesn't happen on iOS with px sizes, and on Android it can arrive as page zoom

*Location:* DESIGN.md → Typography ("Text scales with the OS setting"); EXPERIENCE.md → Accessibility Floor, Settings ("Text size follows the OS").

**Evidence:** In iOS Safari, `px` font sizes ignore Dynamic Type, so the claim is false for every iPhone player unless the page opts in. In Chrome on Android, the OS font scale is applied as text scaling or as page zoom, depending on version (see finding 1). The two behave differently: page zoom shrinks the CSS viewport, so the layout breakpoints, not just the text, change.

*Fix:* Specify type tokens in `rem`. On iOS, set the root size from `font: -apple-system-body`, clamped to 14–28 px, so Dynamic Type drives it. Add a test matrix to E1: iOS at default and AX1, and Android at 100 / 130 / 200 % font size, at 360 and 320 px viewports.

### 16. **[low]** The mockups don't use the DESIGN.md tokens, so judging legibility from them misleads

*Location:* `terminal-variants.html` and `glyphs.html` (header comment and CSS).

**Evidence:**

- `dim` is drawn as a 62 % mix of accent into bg, not the tokenised hexes. That gives Combat **3.54:1** (fails AA), while Colony and Transcendence come out brighter than spec.
- The Combat accent is `#ff6b4a`, not `#ff7a5c`.
- Deltas are 11 px (spec 12), the meter is 13 px (spec 12), and the log is 12.5 px.
- The worker label is `WRK` (3 letters; spec `WRKR`).
- The phone frame is 720 px tall (spec minimum 640, real viewport about 512).
- Glow is applied to all text.

*Fix:* Regenerate the mockups from the frontmatter tokens (CSS custom properties copied from the YAML) at 360×512 and 360×640. Add one 200 % text frame.

### 17. **[low]** Strip values jitter as they change width

*Location:* DESIGN.md → Components → Resource strip; EXPERIENCE.md ("values refresh at most 4 times a second").

**Evidence:** The mockup uses `justify-content: space-between` with content-sized cells (measured cell widths 20–45 px). A value going from `9 999` to `10.0K`, or a delta appearing or disappearing, reflows every cell.

*Fix:* Use equal fixed cells and centred values (covered by finding 2), and reserve the delta line even when it is empty.

### 18. **[low]** `display` text at 200 % overflows

*Location:* DESIGN.md → Typography (`display` 24/700, +0.1 em), Components → Phase reveal.

**Evidence:** `TRANSCENDENCE` is 13 chars × (0.6 + 0.1) × 24 = 218 px at 100 %, which fits. At 200 % it is 437 px against 332.

*Fix:* Apply fit-to-width to `display` (scale down to 70 % of its size, then wrap), and drop letter-spacing to 0.04 em below 28 columns.

### 19. **[low]** In Phase 1, settings are reachable only from the strip at the top of the screen

*Location:* EXPERIENCE.md → Tabs ("the resource strip … tap opens the full resource sheet, which has the settings gear").

**Evidence:** The top edge is the hardest one-handed reach. Fine for a rare action, but reduced motion and CRT effects, which are accessibility settings, sit behind it during a player's first minutes.

*Fix:* Also open the resource sheet with a long-press on the NEST phase line, or put a dim `SETTINGS` secondary action under the Phase 1 primary button until the tab bar appears. Better: show a one-time `CRT EFFECTS: ON · change` line after the cinematic.

### 20. **[low]** Map tile strokes and unknown tiles are below the non-text contrast floor

*Location:* DESIGN.md → Components → Map tile (`stroke: accent @ 0.3`, unknown "dim `?`"); mockup `?` at `fill-opacity .45`.

**Evidence:** The stroke at 30 % is 1.66 (Combat) to 2.32 (Expansion) :1 against `bg`. The mockup's `?` at 45 % is 2.4–3.9:1. Tile boundaries are interactive-component boundaries, so WCAG 1.4.11 asks for 3:1.

*Fix:* Use a stroke opacity of at least 0.45 and render `?` in the `dim` token (≥ 5:1). Partly covered by finding 7. It is listed separately because it applies to the star map's locked planets too (35 % opacity).

### 21. **[low]** Glow filters on an animated SVG scene risk frame drops on low-end Android

*Location:* DESIGN.md → `vector.glow` (`drop-shadow` on vector line-work); EXPERIENCE.md → Game Feel ("ants wander in their chambers").

**Evidence:** A CSS `filter: drop-shadow` on an SVG with hundreds of moving nodes is re-rasterised every frame. That is legibility-adjacent: stutter makes moving ants harder to track and drains battery on 30–90 s check-ins.

*Fix:* Render the scene to a canvas with the glow as a pre-blurred duplicate layer, or confine the filter to static walls and draw the creatures without a filter. Leave this to `gds-game-architecture`, but record the constraint in DESIGN.md.

---

## What holds up

- At 100 % and 360 px, the NEST frame is clean and scannable. The `accent` / `dim` hierarchy works, and `warn` with `−` / `▼` is distinguishable without hue.
- The token contrast table is accurate as written.
- The 1 240-worker dot cloud reads well and keeps the exact count in text.
- Map terrain glyphs at about 15 px inside 40 px tiles are distinct by shape, and the rival nest is distinguishable by both shape and `warn`.
- Select-then-sheet for tiles is the right pattern; it needs the peek-sheet behaviour in finding 7.
- The primary action pinned above a 52 px tab bar sits in the natural thumb arc on every viewport measured.
