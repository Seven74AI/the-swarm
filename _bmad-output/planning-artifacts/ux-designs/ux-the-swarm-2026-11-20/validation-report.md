# Validation Report — THE SWARM

- **DESIGN.md:** `_bmad-output/planning-artifacts/ux-designs/ux-the-swarm-2026-11-20/DESIGN.md`
- **EXPERIENCE.md:** `_bmad-output/planning-artifacts/ux-designs/ux-the-swarm-2026-11-20/EXPERIENCE.md`
- **Run at:** 2026-11-20

## Overall verdict

The rubric walker rates the pair **adequate**. It can serve as a contract once a short list of fixes lands, but it does not yet source-extract cleanly. The shape is right, voice and tone are consistent, every text-contrast claim checks out when recomputed, and the owner decisions carry through both spines: CONTINUE, instant allocation, the ignore policy, the first-launch cinematic, and glyph + label. Five problems block clean extraction:

- The spines and the frontmatter disagree on the sheet background.
- The NEST primary-action priority hangs on terms nobody defines ("critical", "critical path").
- Several components named in EXPERIENCE have no visual spec. Automation targets and research progress have no spec at all.
- Click Power has no home in Phase 1.
- Phase-invariant `warn` and `highlight` contradict identity rule 1.

The rubric raised no critical findings.

The three extra reviewers raise the bar from "adequate with fixes" to "needs one revision pass before hand-off". None calls for a redesign. Each adds one critical finding:

- **Accessibility:** a seizure-safety contradiction. Hold-repeat inverts the full-width primary button at about 8 Hz.
- **Mobile legibility:** the 36-column grid, the 5-cell strip and the vertical stack are tuned to exactly 360×640 at 100 % text. They overflow at 110 % text, at viewports under about 352 px, and in the real 510–560 px browser viewport, while the spec promises 200 % text with no reflow rule. Accessibility independently flags the same reflow gap.
- **Code feasibility:** CONTINUE semantics are undefined. Nothing says whether a met guard is latched or live, or whether it is re-checked on tap, and Colony still has two exits in `transitions.ts`.

Accessibility and mobile legibility both show that scanlines and glow push `dim` text below AA, even though the token contrast table is accurate as written. Code feasibility finds that the check-in loop (Flow 2) cannot be built today because there is no resume-from-background path. Accessibility adds a missing focus model and missing screen-reader semantics for the terminal-text idiom.

## Category verdicts

- Flow coverage — adequate
- Token completeness — adequate
- Component coverage — thin
- State coverage — adequate
- Visual reference coverage — adequate
- Bloat & overspecification — strong
- Inheritance discipline — adequate
- Shape fit — strong

## Findings by severity

These counts are after de-duplication across all four reviews. Raw counts were 3 critical, 24 high, 49 medium and 38 low (114 findings). After merging they are 3 critical, 22 high, 41 medium and 26 low (92).

### Critical (3)

**[Code feasibility]** — CONTINUE semantics are undefined, and Colony has two exits (§ EXPERIENCE → Phase change; `PhaseStateMachine.ts:26-38`, `transitions.ts:31,71`)
The FSM fires and commits in one step. A guard can stop holding after it was met: workers starve, the guard is unassigned, or VC is spent. The spec does not say whether CONTINUE is latched or live, or what happens if the guard fails before the tap. Colony has two outgoing transitions, so the CONTINUE target is ambiguous.
Fix:
- Spec: CONTINUE is offered while the guard holds. It is re-evaluated every tick and re-checked on tap. If the guard no longer holds, the button reverts to the meter, which shows the failing row.
- Stories: remove `COLONY_TO_EXPANSION` and migrate its E2E seeds. Split the FSM into a pure `evaluate()` and a `commit()` that only the CONTINUE handler calls. Seeds click `data-action="continue"`.

**[Accessibility]** — Hold-repeat makes the primary button flash 8+ times a second (§ EXPERIENCE → Game Feel & Juice; Interaction Primitives; Accessibility Floor)
Holding BUY inverts a full-width 50 px button between `bg` and `accent` at 8 Hz or more. That is a 7.7–21:1 luminance swing, and in Combat it is a saturated red flash. It fails WCAG 2.3.1 and contradicts the spec's own rule "nothing flashes faster than the 1 s cursor blink". This is a seizure-safety issue, not polish.
Fix:
- Invert once on press and hold the inverted state until release.
- Show repeats only through the value and the throttled `+N`.
- Add a DESIGN rule: no element changes luminance more than 3 times in any 1 s.
- Under reduced motion, thicken the border instead of inverting.
- Add a test that counts class toggles during a 2 s hold.

**[Mobile legibility · Accessibility]** — The 36-column grid has no headroom, and 200 % text and 320 px reflow have no rule (§ DESIGN → Typography, Layout & Spacing, Do's and Don'ts; EXPERIENCE → Accessibility Floor)
At 360 px, the 36 columns need 333.6 px of the 332 px available at 110 % text (measured). At 320 px they fail at 100 %. At 200 % only about 19–20 columns fit, so box panels, 24-cell meters and aligned tables all overflow. The only large-text rule ("labels drop first") covers the strip alone. "Text follows the OS" does not happen with px sizes: iOS Dynamic Type ignores them, and Android may apply the OS setting as page zoom, which shrinks the CSS viewport and moves breakpoints. Sources: mobile 1 and 15, accessibility H7.
Fix:
- Treat the column count as an output: `cols = floor(contentWidth / (0.6 × bodySize))`. 36 is the design target; 28 is the floor for box drawing.
- Add a reflow table for ≥ 36, 28–35 and < 28 columns (below 28: CSS borders, stacked tables, short meters).
- Allow 8 px margins below 360 px, and set the reflow floor at 320 px.
- Use `rem` tokens, with the root size driven by `-apple-system-body`. Never disable zoom.
- Add a Playwright check at 320 px with 200 % text, and a device matrix at 100, 130 and 200 %. Verify WCAG 1.4.12 (text spacing).

### High (22)

**[Flow coverage]** — Click Power has no home (§ EXPERIENCE → IA L38, Primary action L32, State Patterns L126)
The GDD's Click tree unlocks in Phase 1 and costs food. Phase 1 has no tab bar, and its only NEST action is **> LAY EGG**, so a story-dev agent has nowhere to put the purchase.
Fix: Say where Click Power is bought in Phase 1: a card under the primary action, or priority (3) of the primary-action rule. Add that step to Flow 1.

**[Token completeness]** — The sheet background contradicts itself (§ DESIGN → Colors L213, `components.bottom-sheet` L158, Elevation L275, Components L299)
Colors says sheets use `raised`. The component token, Elevation and Components all say `bg`. The contrast table measures `dim` on `raised`. `card` has no selected-state token.
Fix: Set `bottom-sheet.background: '{colors.raised}'`, update Elevation and Components to match, and add a `card-selected` token.

**[Token completeness]** — Phase-invariant `warn` and `highlight` contradict Brand rule 1 (§ DESIGN → Brand & Style L190/L195, Do/Don't row 4 L315)
`warn` looks close to `combat-accent` and appears from Phase 1. `highlight` is the Transcendence accent and also appears from Phase 1. A consumer cannot tell which rule wins.
Fix: Either declare `warn` and `highlight` functional colours that rule 1 does not cover, or derive a per-phase variant of each inside that phase's hue family.

**[Component coverage · Code feasibility]** — The NEST primary-action priority relies on undefined terms (§ EXPERIENCE → Primary action L100, Offline summary L106)
Rule (2), "food or capacity is critical", has no threshold. Rule (3), "upgrade on the critical path", has no definition. There is no fallback when no rule matches. The `getNextAction` selector shared by NEST, WRKR and the offline summary therefore has no data source, and two implementers would build two different games. Sources: rubric §3, code L-7 and status row 16.
Fix: Define "critical", for example "food runs out within N minutes" or "capacity ≥ 95 %". Define "critical path" as a per-phase E4 content table. State the fallback.

**[Component coverage]** — Components named in EXPERIENCE have no DESIGN visual spec (§ EXPERIENCE L35, L39, L48, L73, L98, L101, L111–115, L144, L153, L174, L196)
These have no visual spec:
- toast and coach mark
- FRONT segment row
- condensed guard meter
- resource sheet with its gear
- tile, planet and chamber sheets
- offline-summary and battle-summary layouts
- hold-to-confirm ring
- upkeep readout
- strip `•` marker
- floating `+N`
- desktop left rail and dialog

Fix: Add a DESIGN row for each, or one line per component naming the existing spec it uses ("X is a Bottom sheet with …", "X uses Card").

**[Component coverage]** — Automation target and research progress have no spec at all (§ EXPERIENCE → IA L33, Interaction Primitives L144)
Two MVP features have neither a visual nor a behavioural spec.
Fix: Add a row for each to both Components tables, covering control anatomy, the progress readout, the cancel affordance and the states.

**[Code feasibility · Flow coverage · State coverage]** — The decision-event lifecycle has gaps, edge states and a spawn bug (§ EXPERIENCE → Decision event, Flow 4 L245–250, State Patterns L136; `DecisionSystem.ts:141`, `DecisionPopup.ts:22-25`)
- **Spawn bug:** spawn time is absolute against cumulative play time, so an event fires on the first tick after every load, on top of the offline summary.
- **No queue:** a new sheet replaces the open one.
- **Close and reload:** no rule covers an open costly or unavoidable event, so closing the tab escapes it.
- **Flow 4:** never walks the timeout firing, backgrounding mid-timer, or a sheet arriving while another is open.
- **Edge states:** no feedback rule when a costly ignore applies, and none for an event during a phase reveal, the cinematic or the ending.

Sources: code H-4, rubric §1 and §4.
Fix:
- Spec: an event open at close is discarded. The next spawn needs at least 2 min of foreground play. The ignore timer starts when the sheet opens.
- Add a failure path to Flow 4: lock the phone at 12 s, resume at 18 s, let the timer run out, and `THE BEETLES TOOK 3 FORAGERS.` types into the log.
- Add the edge-state rows.
- Stories: session-relative spawn, phase eligibility, and one sheet controller.

**[Code feasibility]** — There is no resume-from-background path, so Flow 2 can't happen (§ EXPERIENCE → State Patterns L123; `Ticker.ts:83`, `main.ts:76-147`)
The 1 s dt cap drops background time, and offline catch-up runs only at bootstrap. On a phone, most check-ins are resumes.
Fix: Treat resume as `visibilitychange` → visible, and run the same catch-up as a cold load through one shared function. State in the spec that resume and cold load behave the same.

**[Code feasibility]** — The guard meter needs the guards decomposed inside `transitions.ts` (§ EXPERIENCE → guard meter; `transitions.ts:20-114`)
The meter's per-condition rows need numbers that exist only inside opaque lambdas. A UI that restates them breaks the rule that `transitions.ts` is the only guard source.
Fix: Add `conditions[]` (label, current, target) to `Transition`, derive `guard` from them, and generate the meter text from them.

**[Code feasibility]** — BUILD in Phase 2 and the P2 strip depend on content the code doesn't have (§ EXPERIENCE → Tabs, strip sets; `PhaseContent.ts:74`, `ResourceSystem.ts:61-63`)
Buildings unlock in Expansion, and wood, stone and nectar come only from territory. An early BUILD tab is therefore a catch-22, and the P2 strip would show three frozen zeros.
Fix: Tag both as dependent on the GDD's role yields. Either ship BUILD with whatever is affordable in Phase 2, or land it after the yield story.

**[Code feasibility]** — Map tiles commit on tap today (§ EXPERIENCE L183; `UIRoot.ts:143-150`)
A tile click claims the tile immediately. That contradicts "a mis-tap only selects and never commits".
Fix: A tap selects the tile and opens the tile sheet, and CLAIM lives in the sheet. Keep the explicit `onTileClick` wiring and the spread after `claimTile`.

**[Accessibility · Mobile legibility]** — Scanlines and glow drop `dim` text below AA, and the CRT-effects default is unspecified (§ DESIGN → `colors.*-dim`, Elevation & Depth, `vector.scanlines`, `vector.glow`; EXPERIENCE → Settings; mockups)
- `dim` on `raised` is 4.61–4.69:1. With scanlines on it averages 4.22–4.31:1, and on the darkened rows it is about 3.4–4.0:1. That is 11–12 px text.
- Fractional device-pixel ratios produce moiré.
- The mockups give `dim` text an accent halo brighter than the glyph, which models at 3.2–3.75:1.
- Text glow blurs small strokes for low-vision and astigmatic players. Combat accent against its halo is 4.65:1.

Sources: accessibility H1 and M12, mobile 4.
Fix:
- Make CRT effects tri-state: SCENE (default), FULL and OFF. In SCENE, scanlines cover the vector scene only, never text panels, the strip, the tab bar or sheets.
- Glow only accent text at 14–15 px or larger, with a blur of 2 px or less. Never glow `dim`.
- Draw scanlines in device pixels.
- Switch effects off automatically when `prefers-contrast: more` is set or text scale exceeds 130 %.
- Alternatively, retune `dim` to at least 5.3:1 on `raised`.
- Measure contrast with effects on, and add a unit test that recomputes it.

**[Accessibility]** — Blinking never stops (§ DESIGN → Primary button, Do/Don't; EXPERIENCE → Flow 1 step 2, Reduced motion; mockups)
The cursor and the TAP prompt blink forever, and neither the reduced-motion setting nor the CRT toggle covers them. This fails WCAG 2.2.2.
Fix: Add cursor and prompt blink to both toggles, showing a steady `█` instead, or stop the blink after 5 s without input.

**[Accessibility]** — There is no focus model (§ EXPERIENCE → Accessibility Floor, Desktop; DESIGN → Components)
The spec defines no focus style, focus order, sheet focus trap or focus return. The pinned bars can obscure focused content (WCAG 2.4.11), and decision sheets must never become a keyboard trap.
Fix: Add a Focus subsection and a focus token:
- A 2 px `highlight` outline that does not depend on glow.
- A defined DOM order.
- Sheets as `role="dialog"` that trap focus and return it on close. Decision sheets get no Esc.
- `scroll-padding-bottom` so pinned bars never hide focus.

**[Accessibility · Code feasibility]** — Single-key shortcuts can't be switched off, and Space is bound to pause today (§ EXPERIENCE → Interaction Primitives → Desktop; `UIRoot.ts:242-259`, `pause.spec.ts`)
Space and 1–5 fire on dictation and on stray keys (WCAG 2.1.4), and Space collides with activating the focused control. In code, Space toggles pause, and the spec has no pause at all. Sources: accessibility H4, code M-9.
Fix:
- Add a setting to turn shortcuts off and remap them.
- Space fires the primary action only when focus is on `body` or the primary button.
- Decide whether pause is removed or moved to settings. If it stays, decision timers pause with it.

**[Accessibility]** — Hold-to-confirm has no non-hold alternative (§ EXPERIENCE → Interaction Primitives, Accessibility Floor; `title-cinematic.html`)
An adjustable duration does not help voice-control or switch users. In the mock, the cinematic skip and TAP TO WAKE are pointer-only `div`s.
Fix:
- Add a "hold / two taps" setting for confirming irreversible actions.
- Holding Enter or Space fills the ring.
- Make skip and wake real buttons.
- Have the ring announce its state.

**[Accessibility]** — Screen readers will read the terminal-text idiom literally (§ DESIGN → Meter, Primary button, Event line, Shapes, Stepper)
Meters read as "left bracket full block …". Button labels start with "greater than". Box borders read as runs of box-drawing characters. Typing effects announce letter by letter.
Fix:
- Mark every decorative character `aria-hidden`.
- Make meters `progressbar` with `aria-valuetext`, and give stepper buttons labels.
- Put the full string in the accessible node at once.
- Use real table and list markup.

**[Mobile legibility · Code feasibility · Accessibility]** — The resource strip overflows with the spec's own number format, and that format contradicts itself (§ DESIGN → Resource strip, Typography L235; EXPERIENCE → Resource strip; `format.ts:59-87`)
- Five `999 999` values need 316 px plus gaps at 100 % text, against 332 px available.
- The binding width is the value, not the label, so "labels drop first" frees nothing.
- The strip renders 69 px tall, against a 56 px token.
- DESIGN says "full to 999 999" but gives `88.2K` as an example. The code uses commas, prints "1.00M", goes scientific at 1e12 in any phase, and rounds fractional eggs.
- At 200 % text the strip becomes icons only.

Sources: mobile 2, code M-2, accessibility L4.
Fix:
- In the strip, cap values and deltas at 5 characters. Show exact values to 9 999, switch to suffixes at 10 000, and drop `/s`. Keep the exact integer in the resource sheet.
- State the suffix ladder past T.
- Make the formatter floor values instead of rounding them.
- Use five equal cells. Above about 125 % text, show 3 cells plus `+2 ▸`, or wrap the strip.
- Give the strip `min-content` height, and mark glyphs `aria-hidden` when a label is visible.

**[Mobile legibility]** — The vertical budget assumes a 640 px viewport, but 640 is the device height (§ EXPERIENCE → Foundation, `form_factor`; DESIGN → Layout & Spacing; mockups)
NEST needs about 580–593 px. A 360×640 Android phone in Chrome gives about 512 px, and an iPhone SE in Safari about 548. At 512 px the tab bar is pushed off-screen.
Fix:
- Restate the minimum as a 360×512 viewport.
- Give the scene a flexible height with `clamp()`.
- Show 1 event line instead of 3 below 560 px.
- Set the pinned primary area to 64 px.
- Use `100dvh`.

**[Mobile legibility]** — The platform monospace stack can't guarantee the grid glyphs (§ DESIGN → Typography, Meter, Shapes, Colors)
`ui-monospace` resolves only in Safari, and Android gets Droid Sans Mono. Liberation Mono has no ✓ or ✗, and the fallback glyph is 47 % wider, which knocks the row off the grid.
Fix: Ship one subset mono web font (15–25 KB). Or limit grid rows to ASCII plus the box and block glyphs, render ✓ ✗ ▲ ▼ as `1ch` inline SVG, and add a device test that checks their width.

**[Mobile legibility]** — The bottom-40 % reach rule can't hold on WRKR or BUILD (§ EXPERIENCE → Accessibility Floor; DESIGN → `spacing.thumb-zone`)
On a 512 px viewport, the tab bar and the pinned primary leave room for about one 44 px row in the bottom 40 %. The rule is written as an E1 done-when, so it will become a failing acceptance test.
Fix: Reword the rule to cover the primary action, the tab bar and the active sheet's actions. Pad scrolling content so any row can reach the zone. Bottom-anchor WRKR, with GATHER nearest the thumb.

**[Mobile legibility · Accessibility]** — Map tiles of 40 px with 1 px gaps cause mis-taps, and the tile sheet hides the map (§ DESIGN → Map tile; EXPERIENCE → Map tile, Accessibility Floor)
- Estimated mis-tap rate is 6–20 % on a 6.4 mm target.
- The 1 px gap breaks the spec's own 8 px spacing and 44 pt floor.
- At 320 px the tiles shrink to 35 px, which the spec does not cover.
- A 200–250 px sheet covers rows 5–8, so a wrong selection is invisible.

Sources: mobile 7, accessibility M5 (tiles).
Fix:
- Use a non-modal peek sheet of 160 px or less that retargets on tap, and auto-scroll to the selected tile.
- Use 2 px gaps.
- Pan the map instead of shrinking tiles.
- Hide the pinned FRONT primary while the sheet is open.
- Restate the tiles as the one deliberate exception to the 44 pt floor, and offer a Large-targets map.

### Medium (41)

**[Flow coverage]** — No flow or pattern for setting a player-set automation target (§ EXPERIENCE → IA L33)
It is an MVP story in E4 ("keep N in training"), mentioned once.
Fix: Add a short flow, or at least a component pattern with the steps.

**[Flow coverage]** — Phases 4–6 have surfaces but no journeys (§ EXPERIENCE → Key Flows, Flow 5 step 1 L254)
Three journeys are unwalked: scout → claim → expedition, ship → launch → entropy, and conversion → ending → LEGACY.
Fix: Add three short flows, or state that they are deferred to the E6/E7 pass.

**[Flow coverage]** — Flow 5 misplaces the LEGACY unlock and has no way out of the ending (§ EXPERIENCE → Flow 5 L255; DESIGN → Transcendence ending L306)
The GDD unlocks prestige by condition, which can be met before Transcendence. No input leaves the ending's empty screen.
Fix: Align the flow with the GDD rule, and state the exit input and where it lands.

**[Token completeness]** — The top-level `vector:` group is outside the design.md schema (§ DESIGN → frontmatter `vector:`)
A conformant resolver may drop it, which breaks `{vector.*}` references. `glow` and `scanlines` hold prose, not values.
Fix: Move the values into the components that use them as CSS-valid strings. Or declare `vector:` an extension group and clean up its values.

**[Token completeness]** — Compound component values don't flatten to CSS (§ DESIGN → components: nest-scene, borders, map-tile, title-cinematic)
Examples: `'{colors.accent} @ 0.3'`, `'1.5px {colors.accent}'`, `Phase 1 only`.
Fix: Split them into `color`, `opacity` and `width` keys. Point `title-cinematic` at the egg tokens.

**[Token completeness]** — Component states described in prose have no tokens (§ DESIGN → Components L293/L297/L298; EXPERIENCE L165)
Disabled, pressed, newly affordable, strip capped, meter `warn` fill and tab `•` have no tokens.
Fix: Add `disabled`, `pressed` and `highlighted` sub-tokens to `button-primary`, `card`, `resource-strip` and `meter`.

**[Component coverage]** — The settings gear and the hold-to-confirm ring are non-text graphics (§ DESIGN → Do/Don't L313–314, Glyphs L291)
Both conflict with "glyphs only inside text" and "no vector buttons", and the glyph inventory has no gear.
Fix: Use `[ SETTINGS ]` as a text control, or add a gear glyph with a stated exception. Draw the ring as a text meter.

**[Component coverage]** — Recruitment, soldier training and the expedition result are unspecified (§ EXPERIENCE → IA MAP/ExpeditionPanel, Flow 3 step 5)
Scout and warrior recruitment is a separate system from combat soldiers. The GDD has failed and partial expedition outcomes.
Fix: Add patterns for recruitment, training (the control and the queue) and the expedition result.

**[Component coverage]** — Component names differ across the spines, and the ending has no behaviour row (§ DESIGN → Primary button, Phase reveal, Transcendence ending L306)
DESIGN says Primary button and Phase reveal. EXPERIENCE says Primary action and Phase change.
Fix: Use one name per component, and add a Transcendence ending row (duration, skip, input blocking, what follows).

**[State coverage · Code feasibility]** — NEST has no states for Phase 6, after the ending, or no primary-action candidate (§ EXPERIENCE → State Patterns, L32)
"Transcendence conversion" matches nothing in code or in the GDD (code L-5).
Fix: Name the conversion or fold it into "the ending", then add the rows.

**[State coverage · Code feasibility]** — Persistence failure states are missing, and corrupt saves are recovered silently (§ EXPERIENCE → State Patterns L138; `SaveManager.ts:114-135`, `main.ts:76`)
Missing: save write failure, an invalid import, and a successful import that overwrites the run. Today the code falls back to a backup silently, and a total failure starts a fresh game without a message.
Fix: Add the rows, and say whether a usable backup loads automatically with a notice or waits for the player. `load()` returns a status. Write error copy if export and import stay.

**[State coverage]** — FRONT and BUILD surfaces have one state or none (§ EXPERIENCE → State Patterns)
Missing states:
- WAR: no soldiers, training in progress, no enemy.
- MAP: first visit, expedition returned.
- STARS: no ship, entropy high.
- BUILD: research running, max level.
- WRKR: roles being revealed, upkeep higher than income.

Fix: Add one row per state.

**[Visual reference coverage]** — `terminal-variants.html` is linked only generically (§ DESIGN → Mockups L288, Nest scene L301, Map tile L302, Star map L303)
DESIGN never says which variants are superseded.
Fix: Link the file at those three rows, and copy the superseded note into DESIGN.

**[Inheritance discipline · Code feasibility]** — The resource-label glossary drifts (§ DESIGN skeleton L246, Glyphs L290; EXPERIENCE L98)
`WRK` and `EGG` break the 4-letter rule, and `VC` has only 2 letters. The Unicode stand-ins ◊ and ◇ are easily confused. `WRKR` is both a tab and a resource.
Fix: Publish one resource table in DESIGN → Glyphs, say whether labels are exactly 4 letters or at most 4, and fix the skeleton.

**[Inheritance discipline]** — The map terrain names are not the GDD's (§ DESIGN → Map tile L302)
"Water" doesn't exist in the GDD, and "Empty" is missing.
Fix: Use Forest, Meadow, Mountain, Empty and Enemy Nest. Give Empty a glyph.

**[Inheritance discipline]** — "Guard" means two things (§ EXPERIENCE L84; DESIGN L232)
It names both the phase guard and the GUARD role, and both appear in one readout.
Fix: Rename the meter ("next-phase meter") and label the condition row `GUARD 0/1`.

**[Inheritance discipline · Code feasibility]** — The guard meter names the next phase, against the no-preview rule (§ EXPERIENCE L84, L107, L208)
Fix: Allow the next phase's name explicitly (never its colour or layout), or use a neutral "NEXT AT …".

**[Inheritance discipline]** — `OVERCROWDING!` breaks the no-exclamation rule (§ EXPERIENCE → Flow 4 step 3 L249, Voice and Tone L78)
Fix: Render it as `OVERCROWDING.` and note the rename for E4.

**[Accessibility · Mobile legibility · Token completeness]** — Some non-text UI falls below 3:1 (§ DESIGN → Map tile, Meter, Star map, Colors)
The tile stroke at 30 % measures 1.66–2.46:1. Empty meter cells in `line` measure 1.48–2.03:1. The `?` at 45 % measures 2.4–3.9:1, and locked planets at 35 % measure 2.36:1. The spec states no non-text contrast target. Sources: accessibility M9, mobile 20, rubric §2.
Fix: Raise the tile stroke to at least 45 %. Draw `?` and empty cells in `dim`. Show locked planets in `dim` with a LOCKED label. State the non-text targets.

**[Mobile legibility · Token completeness]** — The 11 px label is too small and conflicts with the 12 px interactive floor (§ DESIGN → Typography L232/L236; EXPERIENCE L98)
At arm's length an 11 px cap is about 7.5′ against a 12′ critical print size, and the strip cell is a tap target. Sources: mobile 9, rubric §2.
Fix: Raise `label` to 12 px. No `dim` text below 12 px, and no sentence case below 13 px. Set the cost line at 13 px with the shortfall in `warn`.

**[Accessibility]** — All-caps monospace and 4-letter abbreviations (§ DESIGN → Typography; EXPERIENCE → Voice and Tone, Resource strip)
Fix: Author strings in sentence case and upper-case them with CSS. Add a Readable text setting, give each abbreviation a full accessible name, and test on VoiceOver and TalkBack.

**[Accessibility]** — The primary action's target changes under the thumb (§ EXPERIENCE → Primary action)
Fix: Change the label at most once every 2 s. Ignore taps within 400 ms of a change. Lock a hold to the target it started on.

**[Accessibility]** — The live-region policy is too narrow (§ EXPERIENCE → Accessibility Floor)
Fix: Add a table of polite, throttled, dialog and timer announcements. LOG uses `role="log"`.

**[Accessibility]** — The nest scene is one image with tappable chambers (§ EXPERIENCE → Accessibility Floor, Nest scene)
Fix: Add a list of chamber buttons next to the scene, and update the scene's label only when a threshold changes.

**[Accessibility]** — Event lines and several controls are under 44 px or unsized (§ EXPERIENCE → Event line; DESIGN → Stepper multiplier, segment row, gear, chambers)
Tappable event lines are about 16 px tall. The multiplier row, the segment row, the chambers and the gear have no stated size.
Fix: Give each of them a 44 px minimum hit area.

**[Accessibility]** — Players can't find the decision-timer setting when it matters (§ EXPERIENCE → Decision event, Navigation rules, Flow 6)
Fix: Add `MORE TIME (+30s)` and a one-time hint. Make the first costly event in a save untimed. Pause timers after 60 s without input.

**[Accessibility]** — Reduced motion misses several animations (§ EXPERIENCE → Game Feel → Reduced motion; DESIGN → Transcendence ending)
The list misses the Transcendence break-apart, `+N`, the hatch walk-off, the affordable glow, the invert, typed headlines and the strip flash.
Fix: Extend the list. Turn CRT effects off by default under `prefers-contrast` or `forced-colors`.

**[Accessibility]** — The selected tile differs from claimed tiles only by stroke width (§ DESIGN → Colors `highlight`, Map tile)
Fix: Mark selection with a shape (corner brackets or an inverted fill) plus `aria-selected`. Give "new" a text marker.

**[Accessibility]** — Map panning needs a non-drag alternative, and taps need pointer cancellation (§ DESIGN → Layout; EXPERIENCE → Map tile, Star map)
Fix: Add pan buttons, arrow keys and centre-on-home. Commit taps on `pointerup`.

**[Accessibility]** — Phase 1 demands many repeated inputs (§ EXPERIENCE → Accessibility Floor, Tabs)
Fix: State a LAY EGG ×MAX or LAY 10 option, or a lay-continuously toggle.

**[Mobile legibility]** — 15 px values can't share a grid row with 14 px body text (§ DESIGN → Typography, Role row, Stepper, Card)
Fix: Set grid-row values at 14 px bold, or in fixed slots.

**[Mobile legibility]** — The 9 px worker reads as a dash, and eggs and larvae are hard to tell apart (§ DESIGN → Nest scene)
Fix: Add a scene camera scale (2× in Phase 1, pulling back as chambers are dug), with a 12 px floor for an individual worker.

**[Mobile legibility]** — The cloud threshold of 300 per chamber is too high (§ DESIGN → Nest scene; EXPERIENCE → Nest scene)
Fix: Switch to the cloud by density (more than about 15 % of the chamber covered). Keep 30–50 animated ants on top, and cap individuals at about 150 across the scene.

**[Mobile legibility]** — Scene count labels are SVG text (§ DESIGN → Brand rule 3, Do's; `terminal-variants.html`)
Fix: Use HTML labels overlaid on the scene in `meta` and `dim`, with a `bg` backing plate. Never smaller than `meta`.

**[Mobile legibility]** — The tab bar overflows at about 148 % text (§ DESIGN → Tab bar)
Fix: Use 4-letter tab names and an inverse fill for the active tab. Above 150 % text, let the bar grow to two lines.

**[Mobile legibility]** — Primary-button labels have no wrap rule (§ DESIGN → Primary button; EXPERIENCE → Primary action)
Fix: Allow at most 2 lines. Drop the qualifier first, then the target, never the verb. Cap generated labels at 24 characters.

**[Code feasibility]** — The decision data model doesn't fit the three-policy model (§ `DecisionSystem.ts:9-14, 33, 42-44, 54`)
Fix: Add `ignorePolicy`, `timerMs?`, `ignoreLine`, `ignore` and a structured `cost` to each event. Retire the Ignore and Wait buttons.

**[Code feasibility]** — Reusing the existing phase reveal brings three defects (§ `main.css:1252`, `UIRoot.ts:474`, `PhaseContent.ts:181`)
The overlay does not block input, so its click-to-skip never fires. Skip is keyed to `prestigeCount` instead of "seen once". "Seen once" needs a lifetime seen-set.
Fix: Add `revealsSeen`. If it goes in the save, add it in one SAVE_VERSION 14 step shared with any other v14 story. Otherwise store it next to the onboarding key.

**[Code feasibility]** — The event log lives only in component memory (§ `EventLog.ts:8,22`)
Fix: State whether LOG persists across reloads. If it does, that is a save field and a migration.

**[Code feasibility · Accessibility · State coverage]** — No settings exist yet, the Settings row is incomplete, and some platforms can't support it (§ EXPERIENCE → State Patterns, Settings L138, Game Feel; `AudioSystem.ts:14`)
- Audio defaults to on, and there is no reduced-motion CSS.
- iOS Safari has no Vibration API, and notifications need a service worker.
- The GDD mutes sound on mobile only, while the spec mutes it everywhere.
- The Settings row omits the hold-to-confirm duration and the device's silent mode.

Sources: code M-7, accessibility L7, rubric §4.
Fix:
- Write "Haptics where supported", and state that haptics are never the only feedback.
- Store settings outside the save, and say whether export includes them.
- Pick one sound default.
- Add the hold duration and silent mode to the Settings row.

**[Code feasibility]** — The first-launch cinematic will block E2E tests (§ `main.ts:364-368`, `OnboardingManager.ts`)
Fix: Define first launch as "no save in any slot and the intro flag unset", and add a test helper that sets the flag.

### Low (26)

**[Flow coverage]** — Small gaps in Flows 2, 3, 5 and 6 (§ EXPERIENCE → Key Flows L261)
Fix: Add one line each (context, climax, failure path).

**[Flow coverage]** — No journey covers research (§ EXPERIENCE → Interaction Primitives L144)
Fix: Fold it into an automation flow or a BUILD flow.

**[Token completeness]** — `spacing:` holds non-dimensions, and `rounded.phone` tokenizes the OS screen corner (§ DESIGN → frontmatter)
Fix: Move `grid-columns` and `thumb-zone` into the prose, and drop `rounded.phone`.

**[State coverage]** — Cold load, offline, notification-denied and empty-LOG states are missing (§ EXPERIENCE → State Patterns)
Fix: Add one row each.

**[Visual reference coverage · Accessibility · Mobile legibility]** — Mockup values don't match the tokens (§ `mockups/` all three)
The mocks use off-palette hexes and a 62 % `dim` mix (3.54:1 in Combat), with off-spec sizes, `WRK`, a 720 px frame, glow on all text and a click-only skip. Sources: rubric §5, accessibility L3, mobile 16.
Fix: Add a line under Mockups saying that frontmatter tokens are normative. Regenerate the mocks from the tokens at 360×512 and 360×640, with one frame at 200 % text.

**[Visual reference coverage]** — "Spine wins" is stated twice, and the mocks aren't linked where they apply (§ DESIGN L288; EXPERIENCE L274)
Fix: Keep one canonical statement, and link the mocks inline at Flow 1 and Map tile.

**[Bloat & overspecification]** — Brand & Style retells the Discovery history (§ DESIGN → Brand & Style L186)
Fix: Cut it to one sentence, or drop it.

**[Bloat & overspecification]** — The implementation notes are tied to one commit (§ EXPERIENCE L263–270)
Fix: Label them non-normative, or move them to the architecture input.

**[Bloat & overspecification]** — Copy in the flows may read as a content commitment (§ EXPERIENCE → Key Flows)
Fix: Mark E4 copy as illustrative.

**[Inheritance discipline]** — Dismantling, the Space generalisation, and a missing source (§ EXPERIENCE → Interaction Primitives L144/L146)
Fix: Drop dismantling or tag it [ASSUMPTION]. Note the Space generalisation as deliberate. Add the GDD decision log to `sources`.

**[Inheritance discipline · Code feasibility]** — Superseded decision-log lines are not marked (§ `.decision-log.md` L15, L28)
The staged-edits assumption and the ONE UNIVERSE tagline were superseded, but the log does not say so. The spec correctly uses ONE SWARM.
Fix: Mark both lines as superseded.

**[Shape fit]** — Implementation notes and Mockups come after Key Flows (§ EXPERIENCE → end)
Fix: Move both above Key Flows, or under an appendix heading.

**[Shape fit]** — The frontmatter carries extra metadata keys (§ DESIGN → frontmatter)
Fix: Nothing needed beyond the `vector` fix. Optionally note that they are BMAD metadata.

**[Accessibility]** — The contrast claims are slightly wrong or razor-thin (§ DESIGN → Colors → Contrast)
Accent on `raised` is 7.094:1 in Combat, against a claim of 7.1. `warn` on Colony `raised` is 8.0012:1, against a claim of 8.0.
Fix: Restate the claims as ≥ 7.0 and ≥ 7.9, leave 0.3 of headroom, and add a test that recomputes them.

**[Accessibility]** — Disabled controls use 40 % opacity (§ DESIGN → Primary button)
Fix: Draw disabled labels in `dim` with a dashed border, and set `aria-disabled`.

**[Accessibility]** — Landscape must not be blocked (§ EXPERIENCE → Responsive & Platform)
Fix: No orientation lock, and un-pin the primary action when the viewport is under 480 px tall.

**[Accessibility]** — The coach-mark dismiss tap may pass through to the control underneath (§ EXPERIENCE → Coach mark)
Fix: Consume the tap, and add a focusable "Got it" button.

**[Accessibility]** — Combat `accent` and `warn` are only 1.23:1 apart (§ DESIGN → Colors, Resource strip)
Fix: Prefix negative deltas with `▼` and use a true minus (U+2212). Lint that every `warn` element also carries a symbol or a word.

**[Mobile legibility]** — Strip values jitter as they change width (§ DESIGN → Resource strip)
Fix: Use equal fixed cells with centred values, and reserve the delta line even when it is empty.

**[Mobile legibility]** — `display` text overflows at 200 % (§ DESIGN → Typography, Phase reveal)
Fix: Fit it to the width, then wrap. Reduce letter-spacing below 28 columns.

**[Mobile legibility]** — In Phase 1, settings are reachable only from the top of the screen (§ EXPERIENCE → Tabs)
Fix: Add a second way in, such as a long-press on the phase line, a SETTINGS action under the primary, or a one-time CRT line.

**[Mobile legibility]** — Glow filters on the animated SVG scene may drop frames on low-end Android (§ DESIGN → `vector.glow`)
Fix: Use a canvas with a pre-blurred glow layer, or apply the filter only to static walls. Record the constraint for architecture.

**[Code feasibility]** — The offline-summary threshold and the cap copy don't match the code (§ `main.ts:131`, `OfflineProgression.ts:97`)
The code shows the summary after 30 s and the spec after 1 min. The code caps offline time at 4 h, and the GDD at 12–24 h.
Fix: Have the copy read the live cap. No literal `12H`.

**[Code feasibility]** — The strip's 4 Hz refresh needs a throttle (§ `ResourcePanel.ts:150`, `TranscendencePanel.ts:31-35`)
Fix: Throttle it or use `computed` slices (issue #186).

**[Code feasibility]** — Battles can end in a draw, and the summary has no DRAW (§ `BattleSystem.ts:174`)
Fix: Add a DRAW line ("THEY RETREATED.").

**[Code feasibility]** — The Research row can over-assign workers (§ `ResourceSystem.ts:315`)
Fix: Include `researchers` in the `assignWorker` total.

## Reviewer files

- `review-rubric.md`
- `review-accessibility.md`
- `review-mobile-legibility.md`
- `review-code-feasibility.md`
