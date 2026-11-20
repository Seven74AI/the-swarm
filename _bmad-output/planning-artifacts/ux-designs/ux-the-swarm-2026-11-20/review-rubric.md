# Spine Pair Review — the-swarm

Reviewer: rubric walker. Scope: `DESIGN.md` + `EXPERIENCE.md` as the contract for downstream consumers (architecture, story-dev). Read: both spines, `.decision-log.md`, `mockups/` (skimmed), sources (`gdd.md`, `epics.md`, `brief.md`), the gds-ux example shapes and `design-md-spec.md`. Line numbers refer to the files as of this review.

## Overall verdict

**Adequate. Usable as a contract once a short list of fixes lands; it does not yet source-extract cleanly.** The shape is right, the voice and tone are consistent, every text-contrast claim checks out when recomputed, and the owner decisions (CONTINUE, instant allocation, ignore policy, first-launch cinematic, glyph + label) carry through both spines. What blocks clean extraction:

1. **The two spines and the frontmatter disagree on the sheet background.** Colors says `raised`, while the components token and Elevation say `bg`.
2. **The NEST primary-action priority depends on terms nobody defines.** It is the most load-bearing behaviour rule, and it hangs on "critical" and "critical path".
3. **Several components named in EXPERIENCE have no visual spec, and some MVP ones have no spec at all.** Automation targets and research progress are the clearest cases.
4. **One GDD Phase 1 feature has no home.** Click Power is never placed.
5. **Phase-invariant `warn`/`highlight` contradict identity rule 1.** No phase may show another phase's colour early, yet both appear from Phase 1.

No critical findings. 6 high, 20 medium, 18 low.

## 1. Flow coverage — adequate

Extracted journeys from the sources: the first session and P1→P2 (Flow 1), the check-in loop (Flow 2), P2→P3 (Flow 2), the combat loss and its counterplay (Flow 3), decision events (Flow 4), prestige (Flow 5), the desktop session (Flow 6). These have no flow: automation targets (E4, MVP), research start and cancel, Expansion map play (E6), Space and entropy (E6), and the Transcendence conversion and ending (E7). Flows 1, 2 and 4 have a named protagonist, numbered steps and a bold **Climax**. Flows 1 and 2 have a failure path.

### Findings
- **[high]** Click Power has no home. The GDD's Click tree unlocks in Phase 1 and costs food (gdd.md *Upgrade Trees*), but Phase 1 has no tab bar (EXPERIENCE L38) and the only Phase 1 action on NEST is **> LAY EGG** (L32, State Patterns L126). A story-dev agent cannot place the purchase. *Fix:* say where Click Power is bought in Phase 1 (for example, a single card under the primary action, or priority (3) of the primary-action rule), and add that step to Flow 1.
- **[medium]** No flow, and no pattern (see §3), for setting a **player-set automation target**, an MVP story in E4 ("keep N in training"). IA mentions "automation targets" only once, on WRKR (L33). *Fix:* add a short flow ("Dev sets keep 20 soldiers in training") or at least a component pattern with the step-by-step.
- **[medium]** Flow 4 (L245–250) has no failure or timeout path, although it is where the new owner decision on ignore policy lives. It never walks the costly-ignore timeout firing, the app being backgrounded mid-timer (the timer pause), or an unavoidable sheet arriving while another sheet is open. *Fix:* add a failure path: "She locks the phone at 12 s; on return the timer resumes at 18 s; she lets it run out; `THE BEETLES TOOK 3 FORAGERS.` types into the log."
- **[medium]** Phases 4–6 have surfaces in the IA (FRONT → MAP and STARS, NEST in Phase 6) but no journeys. Flow 5 step 1 compresses the ending into backstory (L254). Scout → claim → expedition result, ship → launch → explore → entropy, and the Transcendence conversion → ending → LEGACY are all unwalked. *Fix:* add three short flows, or state explicitly in Key Flows that they are deferred to the E6/E7 UX pass.
- **[medium]** Flow 5 implies LEGACY first appears after the ending ("LOG → LEGACY is now there", L255). The GDD unlocks prestige by condition instead: Barracks, Walls and Warehouse at Lv.5 plus lifetime production. That can be met before Transcendence. The flow also gives no step from the ending's empty screen (DESIGN L306) back to the game or to LOG. *Fix:* align the flow with the unlock rule in the GDD, and state what input leaves the ending screen and where it lands.
- **[low]** Flow 2 names "Dev" without the context sentence the other flows have. Flow 6 (L261) is unnumbered prose with no climax. Flows 3 and 5 have no failure path (Mandibles unaffordable; the hold on **> PRESTIGE** released early). *Fix:* add one line each.
- **[low]** No journey covers research: starting a chain, the progress readout, and cancelling with hold-to-confirm for the 50 % refund (Interaction Primitives L144). *Fix:* fold it into an automation flow or a BUILD flow.

## 2. Token completeness — adequate

Every `{path.to.token}` in prose and in `components:` resolves to a frontmatter key. Checked: `spacing.margin-mobile`, `colors.scrim`, `vector.glow`, `vector.scanlines`, `vector.glyph-stroke`, `rounded.none`, `rounded.phone`, `typography.*`, `spacing.strip-height`, `tab-bar-height`, `hit-min`, `map-tile`, `colors.highlight`, `colors.warn`. Every colour token is a hex or an alias. I recomputed the contrast claims (DESIGN L217) with WCAG 2.x and all hold. Minimum values: accent/bg 7.74 (Combat), accent/raised 7.09, dim/bg 5.03, dim/raised 4.61 (Egg, Combat), warn/raised 8.00 (Colony), on-accent 7.74.

### Findings
- **[high]** The sheet background contradicts itself. Colors: "`raised`: sheet and selected-card backgrounds" (DESIGN L213). But `components.bottom-sheet.background: '{colors.bg}'` (L158), Elevation says "Sheet: `bg`" (L275), and Components says "Bottom sheet: `bg`" (L299). The contrast table was measured for `dim` on `raised`, which implies `raised` is used. `card` has no selected-state token either. *Fix:* pick one. Recommended: `bottom-sheet.background: '{colors.raised}'`, update Elevation and Components, and add a `card-selected` (or `card.selected`) token.
- **[high]** Phase-invariant `warn` (`#ff9a6b`) and `highlight` (`#ffffff`) contradict Brand rule 1 (L190), "Not: … a second accent colour inside a phase" (L195), and Do/Don't row 4 (L315). `warn` is visually close to `combat-accent` (`#ff7a5c`) and appears in Phase 1 (Flow 1 step 5: FOOD turns `warn`). `highlight` is the Transcendence accent and appears from Phase 1 (pending markers, "new" emphasis). A lint-minded consumer cannot tell which rule wins. *Fix:* either state in Brand & Style that `warn` and `highlight` are functional colours exempt from rule 1, or derive a per-phase `warn` and `highlight` within each phase's hue family.
- **[medium]** The top-level `vector:` group is not in the design.md token schema (`design-md-spec.md` lists only colors, typography, rounded, spacing and components). A spec-conformant resolver or linter may drop it, which silently breaks `{vector.glyph-grid}` (resource-strip.glyph), `{vector.soil-fill-opacity}` and `{vector.wall-opacity}` (nest-scene), and the prose references. Two of its values are prose, not values: `glow: 'drop-shadow(0 0 3px accent @ 55–70 %)'` uses a bare `accent` and a range, and `scanlines` is a sentence. *Judgment:* keeping a custom group is defensible for a vector-heavy game, but only if it is declared and its values are machine-usable. *Fix:* preferred, move the stroke and opacity values into the components that use them (a new `glyph` component, plus `nest-scene` and `map-tile`) and express glow and scanlines as CSS-valid strings with `{colors.accent}` and one number each. Otherwise keep `vector:` and add a sentence under Elevation & Depth declaring it an extension group, with the same value clean-up.
- **[medium]** Several component values are compound strings that will not flatten to usable CSS: `'{colors.accent} @ {vector.soil-fill-opacity}'`, `'1.5px {colors.accent}'` (borders), `map-tile.claimed: '{colors.accent} fill @ 0.18, stroke @ 1'`, `map-tile.stroke: '{colors.accent} @ 0.3'`, `title-cinematic.palette: Phase 1 only`. *Fix:* split them into `color` + `opacity` + `width` keys. Set `title-cinematic` to `'{colors.egg-bg}'` and `'{colors.egg-accent}'`.
- **[medium]** Component states described in prose have no tokens: primary button disabled (40 % opacity, L293), pressed (inverts to an accent fill for 100 ms, which needs `on-accent`, EXPERIENCE L165), card newly affordable (accent border plus glow for 2 s, L297), strip capped (`warn` with ▲), meter `warn` fill above 75 % (L298), tab `•`. *Fix:* add `disabled`, `pressed` and `highlighted` sub-tokens to `button-primary`, `card`, `resource-strip` and `meter`.
- **[low]** The `spacing:` group holds non-dimensions: `grid-columns: 36` is a count and `thumb-zone: 40vh` is a viewport fraction, not spacing. `rounded.phone` tokenizes a corner the OS supplies (L284). *Fix:* move `grid-columns` and `thumb-zone` into a `layout` note or the prose. Drop `rounded.phone`.
- **[low]** Non-text contrast is not stated. `line` on `bg` measures 1.48–2.03:1 (card borders, empty meter cells). The unclaimed map-tile stroke (`accent` at 0.3) sits on an interactive element, where WCAG 1.4.11 asks for 3:1. *Fix:* state the non-text targets, and confirm the unclaimed-tile stroke reaches 3:1 or rely explicitly on the terrain glyph to identify the tile.
- **[low]** `label` (11 px) is defined as "Resource-strip labels only (non-interactive)" (L232), but the strip as a whole is a tap target that opens the resource sheet (EXPERIENCE L98). That conflicts with "Interactive text is never below 12 px" (L236). *Fix:* clarify that the tap target is the cell and the label is decoration, or raise the label to 12 px.

## 3. Component coverage — thin

DESIGN Components: Resource strip, Glyphs, Tab bar, Primary button, Secondary action, Stepper, Role row, Card, Meter, Bottom sheet, Event line, Nest scene, Map tile, Star map, Phase reveal, Title cinematic, Transcendence ending. EXPERIENCE Component Patterns: Resource strip, Tab bar, Primary action, Stepper / role row, Card, Meter, Bottom sheet, Decision event, Offline summary, Phase change, Battle summary, Enemy card, Event line, Nest scene, Map tile, Star map, Toast, Coach mark.

### Findings
- **[high]** The NEST primary-action priority (EXPERIENCE L100), which also drives the offline summary's next action (L106), relies on undefined terms. Rule (2) "if food or capacity is **critical**" and rule (3) "an affordable upgrade on the **critical path**" have no threshold and no definition. Nothing says what shows when none of the four rules matches. This is the most load-bearing behaviour in the pair, and two implementers would build two different games. *Fix:* define "critical" (for example, food runs out within N minutes at the current net rate, or capacity ≥ 95 %), define "critical path" (an upgrade that raises a guard-condition rate, or a named list), and state the fallback when nothing matches.
- **[high]** Components named in EXPERIENCE (or in DESIGN prose) that have **no DESIGN visual spec**: Toast (L114), Coach mark (L115), the FRONT segment row `WAR · MAP · STARS` (L35), the condensed guard meter under the strip on other tabs (L48, HUD L153), the resource sheet with its settings gear (L39, L98), the tile, planet and chamber sheets (L111–113), the offline-summary and battle-summary sheet layouts, the hold-to-confirm filling ring (L144), the upkeep readout (L101), the `•` pending marker in the strip (L73), floating `+N` text (L174), and the desktop left rail and centred dialog (L196). *Fix:* add a DESIGN row for each, or one line saying "X is a Bottom sheet with …" / "X uses Card" so a consumer knows which spec applies.
- **[high]** Two MVP features have **neither** a visual nor a behavioural spec: the automation target control (E4; IA L33) and research progress and cancel (BUILD; hold-to-confirm cancel at L144). *Fix:* add a row to both Components tables: control anatomy (stepper or target field), the progress readout, the cancel affordance, and the states.
- **[medium]** The settings gear and the hold-to-confirm ring are non-text interface graphics. They conflict with "glyphs only inside text" (Do/Don't L314), with "no vector buttons" (L313), and with the 20-glyph inventory, which has no gear (DESIGN L291). *Fix:* make settings a text control (`[ SETTINGS ]`) or add a gear glyph with a stated exception, and draw the ring as a text meter `[████····]` filling over 1 s.
- **[medium]** Neither spine says where scouts and warriors are recruited or how the expedition force is assembled. The IA has ExpeditionPanel under MAP, but Barracks recruitment is a separate system (CLAUDE.md: "two soldier systems, don't conflate"). There is also no expedition-result sheet, although the GDD has failed and partial outcomes with proportional losses. Soldier training (the pipeline) is unspecified beyond Flow 3 step 5. *Fix:* add patterns for recruitment, for training (which control, and where the queue shows) and for the expedition result.
- **[medium]** Name mismatches across spines: DESIGN "Primary button" vs EXPERIENCE "Primary action"; DESIGN "Phase reveal" vs EXPERIENCE "Phase change". The Transcendence ending (DESIGN L306) has no behaviour row: duration, whether it can be skipped, whether input is blocked, and what follows. *Fix:* use one name per component across both spines, and add a Transcendence ending row to Component Patterns.

## 4. State coverage — adequate

Covered well: App (first launch, later launch, resume ≥ 1 min and < 1 min, corrupt save), NEST (Phase 1 empty, starving, at capacity, guard met, large colony), sheets pending, phase reveal. FRONT and BUILD are thin: each has one state.

### Findings
- **[medium]** NEST is missing states for Phase 6 (the Transcendence conversion: what it looks like, and its states before and after the guard), for after the ending, and for no primary-action candidate (see §3). *Fix:* add rows.
- **[medium]** Decision-event edge states are not covered. Nothing says what feedback appears when a costly-ignore timeout applies (an event line? a toast?), or what happens when an event fires during a phase reveal, the cinematic or the ending (L136 blocks input; "sheets never stack" covers sheets only). *Fix:* add two rows.
- **[medium]** Persistence failure states are missing: save write failure or storage full, an invalid import file, a successful import (it overwrites the current run, so confirm with hold?). Export/import is still `[ASSUMPTION]` (L138). *Fix:* add rows. If export/import stays, it needs its own error copy in Voice and Tone.
- **[medium]** Most FRONT and BUILD surfaces have one state or none:
  - WAR: no soldiers (why **> FIGHT** is disabled), soldiers in training, no enemy available.
  - MAP: first visit or nothing scouted, expedition returned (success, partial, fail).
  - STARS: no ship yet, entropy high (DESIGN has the `warn` fill at L298, EXPERIENCE has no state).
  - BUILD: research running, max level, combat buildings appearing on Phase 3 entry.
  - WRKR: roles revealed over time (when do Forage and Research appear?), upkeep exceeding income.
  - *Fix:* add one row per state.
- **[low]** Cold load (what renders before the vector scene is ready, against the GDD's "first interactive < 3 s") is unspecified. Nothing says that no network is needed (offline is the normal case, so state it). Notification permission denied, and an empty LOG on first visit, are also missing. *Fix:* one row each.
- **[low]** The Settings row (L138) omits the hold-to-confirm duration setting, which the Accessibility Floor says is adjustable (L185). Nothing mentions respecting the device's silent mode (GDD *Audio*). *Fix:* add both to the Settings row.

## 5. Visual reference coverage — adequate

All three files in `mockups/` are linked: DESIGN L288 (all three), L291 (glyphs), L305 (title cinematic), and EXPERIENCE L276–278. No orphans. "Spine wins on conflict" is stated in both DESIGN L288 and EXPERIENCE L274.

### Findings
- **[medium]** DESIGN links `terminal-variants.html` only generically ("the vector nest and map frames", L288). It does not say that variant 2 (the ASCII nest) and the inline tile panel are superseded. Only EXPERIENCE L277 says so. The file is not linked inline at Nest scene (L301), Map tile (L302) or Star map (L303), where a consumer would look. *Fix:* link it at those three rows, and copy the superseded note into DESIGN.
- **[low]** The mocks carry off-palette values: `#ff6b4a`, `#7da35c` and `#2a3a1c` are in none of the phase sets. The strip mock in `glyphs.html` labels workers `WRK` while its own glyph sheet says `WRKR`. "Spine wins" covers this, but it should be called out so nobody samples colours from the mocks. *Fix:* add one line under Mockups: "Hex values in mocks are pre-final; use DESIGN frontmatter."
- **[low]** "Spine wins" is stated twice, and EXPERIENCE references the mocks only in the closing section. They are not linked inline at Flow 1 (cinematic) or at the Map tile and Nest scene patterns. *Fix:* keep one canonical statement (EXPERIENCE → Mockups) with a pointer from DESIGN, and add inline links at Flow 1 and Map tile.

## 6. Bloat & overspecification — strong

Both spines are compact (DESIGN 320 lines including about 175 lines of frontmatter, EXPERIENCE 278), mostly tables, and mostly decisions rather than prose.

### Findings
- **[low]** Brand & Style L186 retells the Discovery history ("terminal direction (C), then…"). That belongs in `.decision-log.md`. *Fix:* cut it to one sentence or drop it.
- **[low]** "Implementation notes from Discovery" (EXPERIENCE L263–270) is time-bound to `main @ 24da5b1` and is input for architecture and stories, not UX contract. *Fix:* label it non-normative, or move it to the architecture input once that run starts.
- **[low]** The flows script exact copy ("+12 CHITIN ◇", "−1 h of gathering"), and the strip-delta flash and glyph pixel sizes per context are close to overspecification. They are acceptable as examples, but a consumer may read them as content commitments. *Fix:* mark the copy in flows as illustrative where it is E4 content.

## 7. Inheritance discipline — adequate

Sources resolve: `gdd.md`, `epics.md` and `brief.md` all exist. Tab names are identical across the spines (NEST · WRKR · BUILD · FRONT · LOG, segments WAR · MAP · STARS, LEGACY). Guard values in the flows match the GDD (10 workers; 50 workers + 1 guard; wins toward 5). The title tagline matches the final decision (ONE SWARM, not the superseded ONE UNIVERSE).

### Findings
- **[medium]** The resource-label glossary drifts:
  - The DESIGN skeleton shows `⌘WRK` (L246), while EXPERIENCE (L98) and the glyph sheet say `WRKR`.
  - `VC` has 2 letters, against the 4-letter-label rule (L290).
  - The skeleton and copy examples use Unicode stand-ins (◊ ⌘ ▭ △ ✺ ◇) as if they were the glyphs, and ◊ (food) vs ◇ (chitin) are easy to confuse.
  - `WRKR` is both a tab label and a resource label.
  - *Fix:* publish one resource table (label, full name, glyph name) in DESIGN → Glyphs, fix `WRK`, decide on `VC` (`VOID`?), and state that the Unicode marks in examples stand in for vector glyphs.
- **[medium]** Map terrain names are not verbatim from the GDD. DESIGN L302 lists "rock ridge, water wave, rival nest". The GDD types are Forest, Meadow, Mountain, Empty and Enemy Nest. "Water" does not exist, and "Empty" is missing. *Fix:* use the GDD names and give Empty a glyph (or a plain tile).
- **[medium]** "Guard" means two things. It is the phase guard (guard meter, "guard met") and also the GUARD worker role (CONTEXT.md: "Guard: soldiers for combat"). Both appear in one readout: `COMBAT AT 50 WORKERS + 1 GUARD`, `workers 50/50 ✓ · guard ✗` (L84, L232). *Fix:* keep "guard" for the role in player-facing copy, call the meter something else (for example "next-phase meter"), and label the condition row `GUARD 0/1`.
- **[medium]** The rules contradict each other on naming the next phase. The guard-meter copy names it (`COMBAT AT …`, `COLONY AT …`), while Phase change says "Nothing about the next phase shows before the tap" (L107) and Inspiration rejects "any preview of later phases" (L208). *Fix:* state explicitly that the next phase's name in the guard meter is the one allowed preview, and that its colour and layout are not.
- **[medium]** `OVERCROWDING!` (Flow 4 step 3, L249) breaks Voice and Tone's "Neither uses exclamation marks" (L78). The name is inherited from the GDD's baseline event list. *Fix:* render it as `OVERCROWDING.` in UI copy and note the rename for E4.
- **[low]** "Dismantling" (Interaction Primitives L144) is not a GDD mechanic. Desktop "Space triggers the primary action" (L146) generalises the GDD's "Space lays an egg". The GDD `decision-log.md` was read (decision log L6) but is not listed in `sources`. *Fix:* drop dismantling or flag it `[ASSUMPTION]`, note the Space generalisation as deliberate, and add the GDD decision log to `sources`.
- **[low]** The decision log records an [ASSUMPTION] of "staged role edits with Apply" (L15), superseded by Q5. The spines are correct, but the log has no explicit "superseded" mark on that line. *Fix:* annotate the log line for traceability.

## 8. Shape fit — strong

DESIGN.md has all 8 canonical sections in order: Brand & Style → Colors → Typography → Layout & Spacing → Elevation & Depth → Shapes → Components → Do's and Don'ts. EXPERIENCE.md has every required default (Foundation, Information Architecture, Voice and Tone, Component Patterns, State Patterns, Interaction Primitives, Accessibility Floor, Key Flows), plus the game-example sections (HUD & Diegetic UI, Game Feel & Juice, Responsive & Platform, Inspiration & Anti-patterns). Input schemes are folded into Interaction Primitives, which is fine for a touch-first game.

### Findings
- **[low]** EXPERIENCE places "Implementation notes" and "Mockups" after Key Flows. Both examples end on Key Flows. *Fix:* move both above Key Flows, or into an appendix heading.
- **[low]** The DESIGN frontmatter carries metadata keys (`title`, `status`, `created`, `updated`, `sources`) beyond the spec's `name` and `description`, plus the `vector` group (§2). The metadata keys are harmless. *Fix:* none needed beyond §2. Optionally note in the body that they are BMAD metadata.

## Mechanical notes

- **Contrast recomputed** (WCAG 2.x relative luminance) for all six phases. All claims at DESIGN L217 hold. Minimums: accent/bg 7.74, accent/raised 7.09, dim/bg 5.03, dim/raised 4.61, warn/raised 8.00, warn/bg 9.38, on-accent 7.74. `line`/bg is 1.48–2.03 (non-text, not claimed).
- **Map fit check:** 8 × 40 px + 7 × 1 px gaps = 327 px; plus 2 × 14 px margins = 355 px ≤ 360 px. Fits without zoom, as claimed (EXPERIENCE L112). The 40 px tiles fall below the GDD's 44 pt, but the Accessibility Floor (L183) states and mitigates the exception.
- **Token references:** every `{…}` resolves to a frontmatter key. Non-resolvable values are the compound strings listed in §2, plus the bare `accent` inside `vector.glow`.
- **Mockups:** 3 files, 0 orphans. `.working/` holds 8 superseded explorations. They are not linked from the spines, which is correct.
- **Glyph inventory:** `mockups/glyphs.html` has 14 resources (EGG, LRVA, WRKR, FOOD, WOOD, STON, NECT, SILK, CHTN, VNOM, VC, ANTM, DKMT, SRVY) and 6 buildings, matching DESIGN L291. No glyph exists for nest capacity (the strip shows it), Legacy Points or the settings gear.
- **`[ASSUMPTION]` tags still open in EXPERIENCE:** per-phase strip sets, the WRKR primary action, the 1 min offline threshold, save export, hold acceleration, the shortcut set, no tablet layout, no landscape. The per-phase strip sets and the WRKR primary action are load-bearing for E1 stories.
