# Accessibility review: THE SWARM UX spec (2026-11-20)

Reviewed: `DESIGN.md`, `EXPERIENCE.md`, `mockups/title-cinematic.html`, `mockups/terminal-variants.html`, `mockups/glyphs.html`.
Baseline: WCAG 2.2 AA (as it applies to a web-delivered game), Game Accessibility Guidelines (GAG), Xbox Accessibility Guidelines (XAG).
Reviewer did not edit the spec.

## Verdict

**Not ready to hand off as-is. Needs one revision pass. No redesign needed.**

The base is better than most idle games. It does not rely on colour alone. Decision timers can be turned off. Unavoidable events have no timer. Sound is off by default and audio is never the only channel. The OS reduced-motion setting is honoured, and the mockup already does this for the cinematic. Every hold-repeat has a ×MAX equivalent. The stated palette contrast is almost entirely accurate (one claim misses by 0.01).

The gaps are elsewhere:

- One seizure-safety contradiction: hold-repeat button inversion flashes.
- Missing keyboard, focus and screen-reader semantics for the terminal-text idiom.
- Blinking that never stops.
- Single-key shortcuts.
- A hold-only confirm.
- `dim` text that sits so close to 4.5:1 that the spec's own scanline overlay pushes it below.

Counts: **1 critical, 7 high, 12 medium, 8 low.**

## Contrast table

Recomputed from the DESIGN.md frontmatter hexes with the WCAG 2.x relative-luminance formula (script: sRGB to linear, (L1+0.05)/(L2+0.05)). I also checked that the `raised` = 8 % and `line` = 25 % sRGB mixes match the stated hexes. All six phases match exactly.

| Phase | accent/bg | accent/raised | dim/bg | dim/raised | warn/bg | warn/raised | highlight/bg | on-accent/accent | line/bg (non-text) | tile stroke accent@30 %/bg | dim/raised with scanlines* | accent vs glow halo** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Egg | 10.79 | 9.67 | 5.14 | **4.61** | 9.50 | 8.51 | 19.77 | 10.79 | 1.68 | 1.92 | **4.23** | 5.63 |
| Colony | 16.06 | 13.70 | 5.49 | 4.68 | 9.38 | **8.00** | 19.53 | 16.06 | 2.00 | 2.36 | **4.31** | 6.80 |
| Combat | 7.74 | **7.09** | 5.03 | **4.61** | 9.53 | 8.74 | 19.85 | 7.74 | 1.48 | 1.66 | **4.22** | 4.65 |
| Expansion | 15.71 | 13.55 | 5.40 | 4.66 | 9.43 | 8.13 | 19.64 | 15.71 | 1.97 | 2.32 | **4.29** | 6.78 |
| Space | 12.29 | 10.92 | 5.28 | 4.69 | 9.54 | 8.48 | 19.87 | 12.29 | 1.74 | 2.03 | **4.30** | 6.06 |
| Transcendence | 21.00 | 18.42 | 5.32 | 4.66 | 10.09 | 8.85 | 21.00 | 21.00 | 2.03 | 2.46 | **4.27** | 8.52 |

\* Scanlines are 1 px rows of 18 % black every 3 px, averaged over the three rows in linear light. On the darkened rows alone, `dim`/`raised` is 3.41–3.53.
\** Accent text against a background tinted 30 % toward accent. This approximates the area just outside the glyph stroke under the `text-shadow` glow.

Other pairs:

- **Combat `accent` vs `warn`:** 1.23:1. **Egg `accent` vs `warn`:** 1.14:1. These are practically the same colour, which confirms the spec's "hue never carries meaning alone" rule is load-bearing.
- **`highlight` vs `accent`:** Colony 1.22, Expansion 1.25, Transcendence **1.00**.
- **Disabled controls (accent at 40 % opacity) on `bg`:** 2.11 (Combat) to 3.66.
- **Locked planets (accent at 35 %) on Space `bg`:** 2.36.
- **Mockup** `.tinfo span` (accent 62 % into bg): 3.54 in Combat, below 4.5.

### Claim check (DESIGN.md → Colors → "Contrast (measured)")

| Claim | Result |
|---|---|
| accent on bg 7.7–21:1 | True (7.74 to 21.00) |
| accent on raised ≥ 7.1:1 | **False by a hair.** Combat is 7.094. It still passes 7:1 (AAA). Restate as "≥ 7.0:1" or nudge `combat-raised` darker |
| dim ≥ 5.0:1 on bg | True (min 5.03) |
| dim ≥ 4.6:1 on raised | True (min 4.606), but the margin is 0.1 over AA, and the scanline overlay erases it (see H1) |
| warn ≥ 8.0:1 on every raised | True by 0.001 (Colony 8.0012). Any colour-mix rounding breaks it |
| on-accent on accent ≥ 7.7:1 | True (min 7.74) |

## Findings

### Critical

**C1 [critical] Hold-repeat makes the primary button flash 8+ times a second. WCAG 2.3.1 Three Flashes (A); GAG "avoid flicker".**
*Location:* EXPERIENCE.md → Game Feel & Juice ("Buy: Button inverts (accent fill) for 100 ms") together with Interaction Primitives ("Hold repeats buy, assign and lay at about 8/s, speeding up after 1 s"). Also EXPERIENCE.md → Accessibility Floor ("Nothing flashes faster than the 1 s cursor blink"), which this contradicts.
Holding BUY inverts a full-width, 50 px tall button between `bg` and `accent` at 8 Hz or more. That is a 7.7–21:1 luminance swing. In Combat the accent is a saturated red-orange, which also triggers the red-flash criterion. The button sits close to the general-flash area threshold on a phone held near the face. This is a seizure-safety issue, not a polish issue.
*Fix:*
- Invert once when the press starts and hold the inverted state until release. Never re-invert per repeat.
- Show repeats only through the counting value and the throttled `+N`.
- State a hard rule in DESIGN.md: "No element changes luminance more than 3 times in any 1 s."
- Make the invert a non-flashing border thicken under reduced motion.
- Add a Playwright or unit invariant: count the class toggles during a 2 s hold and assert ≤ 3 per second.

### High

**H1 [high] The `dim` text margin is too thin, and scanlines push it below AA. WCAG 1.4.3 Contrast Minimum (AA).**
*Location:* DESIGN.md → frontmatter `colors.*-dim`, Colors, Elevation & Depth ("Scanlines sit over everything").
`dim`/`raised` is 4.61–4.69. With the 16–20 % scanline overlay over text, the effective ratio is 4.22–4.31 on average and about 3.4 on the darkened rows. This text is 11–12 px: labels, older event lines, cost lines and inactive tabs. That is exactly where small, thin monospace needs the most contrast. CRT effects are presumably on by default, so most players see the failing state.
*Fix:*
- Retune every `dim` to at least 5.3:1 on `raised`, and at least 5.8:1 on `bg`. That keeps ≥ 4.5:1 effective with scanlines on.
- Or render scanlines only over the vector scene layer, not over text panels.
- Then restate the measured claim and record the measurement method, including overlays.
- Add a unit test that recomputes contrast from the theme table so the claim cannot drift.

**H2 [high] Blinking never stops and isn't covered by any toggle. WCAG 2.2.2 Pause, Stop, Hide (A).**
*Location:* DESIGN.md → Components → Primary button ("blinking block cursor `█`"), Do's and Don'ts ("beyond the 1 s cursor blink"); EXPERIENCE.md → Flow 1 step 2 ("[ TAP TO WAKE THE QUEEN ] blinks"), Game Feel → Reduced motion list; mockups (`terminal-variants.html` `animation:b 1s steps(1) infinite`, `title-cinematic.html` `.tap.on … blink 1.4s infinite`).
The cursor blinks forever next to the primary content on every screen. WCAG requires a way to stop blinking that lasts more than 5 s. The reduced-motion list (typing, wandering, palette, cinematic, glow, scanlines) does not mention the cursor or the TAP prompt, and the CRT toggle covers only glow and scanlines. A blinking cursor also pulls attention constantly, which matters for ADHD and vestibular users (GAG).
*Fix:*
- Add "cursor and prompt blink" to both the reduced-motion list and the CRT-effects toggle. When either is on, show a steady `█`.
- Alternatively, stop the blink after 5 s of no input and resume it on the next interaction.

**H3 [high] No focus model: focus indicator, focus order, sheet focus trap and focus return are all unspecified. WCAG 2.4.7 Focus Visible (AA), 2.4.11 Focus Not Obscured (AA, new in 2.2), 2.4.3 Focus Order (A), 2.1.2 No Keyboard Trap (A).**
*Location:* EXPERIENCE.md → Accessibility Floor, Interaction Primitives → Desktop; DESIGN.md → Components (no focus state anywhere).
Desktop is a stated surface, and switch and external-keyboard users exist on mobile too. The spec defines no focus style for buttons, steppers, tabs, tiles or sheet actions. The pinned primary action and the 52 px tab bar can cover focused content as it scrolls (2.4.11). Sheets are modal, but trapping and return are not specified. Decision sheets "close only by choice" and must never become a keyboard trap.
*Fix:* Add a Focus subsection to EXPERIENCE.md and a focus token to DESIGN.md.
- **Indicator:** a 2 px `highlight` outline offset 2 px, or inverted `[ ]` brackets. It needs at least 3:1 against `bg` and must not depend on glow.
- **DOM and focus order:** strip → phase line and meter → scene summary → event lines → primary action → tab bar. On desktop: left rail → column 1 → columns 2–3.
- **Sheets:** use `role="dialog"` with `aria-modal="true"`. Move focus to the headline on open, trap Tab inside the sheet, and return focus to the trigger on close.
- **Decision sheets:** no Esc. Choices remain reachable.
- **Scrolling:** add `scroll-padding-bottom` equal to the pinned bar plus the tab bar, so a focused element is never hidden.

**H4 [high] Single-key desktop shortcuts have no off switch or remapping. WCAG 2.1.4 Character Key Shortcuts (A).**
*Location:* EXPERIENCE.md → Interaction Primitives → Desktop ("Space triggers the primary action, 1–5 switch tabs").
Unmodified printable-key shortcuts fire on speech-input dictation and on stray key presses. Space also conflicts with "activate the focused button": a keyboard user on a stepper presses Space and fires the NEST primary action instead.
*Fix:*
- Add a "Keyboard shortcuts" setting (on/off) and allow remapping (XAG 107).
- Let Space trigger the primary action only when focus is on `body` or the primary button, never when another control has focus.
- Document the shortcuts in settings.

**H5 [high] Hold-to-confirm has no non-hold alternative, and keyboard, switch and voice paths are unspecified. WCAG 2.1.1 Keyboard (A), 2.5.1 / 2.5.2 (A), XAG 107 (input), GAG "avoid holding buttons".**
*Location:* EXPERIENCE.md → Interaction Primitives ("Hold to confirm (1 s, a filling ring)"), Accessibility Floor ("hold-to-confirm duration is adjustable"); `mockups/title-cinematic.html` (skip is a `click` listener on a `div`).
Changing the duration does not help voice-control users ("tap Prestige" cannot hold) or single-switch users. A hold isn't a path-based gesture, so 2.5.1 isn't strictly triggered. Even so, GAG and XAG both ask for an alternative to sustained input. Separately, the cinematic skip and "TAP TO WAKE" are pointer-only in the mock.
*Fix:*
- Add a setting: "Confirm irreversible actions with: hold / two taps." With two taps, the first tap arms the action (label changes to `> TAP AGAIN TO PRESTIGE`, auto-disarms after 5 s) and the second commits.
- On keyboard, holding Enter or Space fills the ring, or the two-step mode applies.
- Make the cinematic skip and TAP TO WAKE real `<button>`s that respond to Enter, Space and Esc, with the accessible name "Skip intro" or "Wake the queen".
- The filling ring announces "Hold to prestige. Release to cancel" and, on completion, "Prestige confirmed".

**H6 [high] The terminal-text idiom will be read out literally by screen readers. WCAG 1.3.1 Info and Relationships (A), 4.1.2 Name, Role, Value (A).**
*Location:* DESIGN.md → Components → Meter (`[████████······]  74%`), Primary button (`> ` prefix, `█` cursor), Event line (`> ` / `· ` prefixes), Shapes (box-drawing panels `┌─┐│└┘`), Stepper (`[−]`, `[ ×1 ]`); EXPERIENCE.md → Accessibility Floor.
VoiceOver and TalkBack will read "left bracket full block full block … middle dot middle dot right bracket 74 percent". Button labels will be read as "greater than buy warehouse … full block", and box borders as runs of "box drawings light horizontal". The Accessibility Floor covers labels and glyph alt text but says nothing about the typed decoration. The typing-in effects (headline, DEFEAT, event lines), if inside a live region, will announce partial strings letter by letter.
*Fix:* Add these rules to the Accessibility Floor.
- Every decorative typed character goes in `aria-hidden="true"` spans or CSS `::before/::after` with `content: "…" / ""` (alt-text-empty syntax): `>`, `·`, `█`, brackets and box drawing.
- Meters are `role="progressbar"` (or `<meter>`) with `aria-valuenow/min/max` and `aria-valuetext="Workers 37 of 50"`. Guard rows are a list with "met" or "not met" in text, not ✓ or ✗ alone.
- The stepper uses `<button aria-label="Remove one gatherer">`.
- Typing effects are visual only: set the full string in the accessible node at once and hide the animated copy from assistive technology.
- Aligned columns use real table or list markup, not spaces.

**H7 [high] The 36-column grid conflicts with 200 % text and 320 px reflow. WCAG 1.4.4 Resize Text (AA), 1.4.10 Reflow (AA).**
*Location:* DESIGN.md → Typography (36-column grid, px sizes in frontmatter), Layout & Spacing (360×640 minimum), Do's and Don'ts; EXPERIENCE.md → Accessibility Floor ("follows the OS up to 200 % without clipping").
At 200 % (14 → 28 px), a 360 px viewport holds about 19 monospace columns. The box-drawn panels, aligned tables, the 5-cell strip and the `[████…]  74%` meter cannot fit. 1.4.10 is tested at 320 CSS px (the 1280 px at 400 % equivalent), but the spec's minimum is 360. Also, "text follows the OS" is not automatic on the web: iOS Dynamic Type does not reach px-sized web text. Many games set `user-scalable=no` or `maximum-scale=1`, which breaks 1.4.4.
*Fix:*
- Set the reflow floor to 320 CSS px.
- Define sizes in `rem` and never disable pinch zoom in the viewport meta.
- Define a "narrow" rule: below 36 available columns, boxes collapse to plain rules, meters shorten to `[█████···] 74%` with 8 cells (or text only, "74 %"), tables become stacked label/value pairs, and the strip wraps to two rows or scrolls horizontally inside itself.
- Add a Playwright check at 320 px with `font-size: 200%`: no horizontal page scroll and every control visible.
- Also verify 1.4.12 Text Spacing: overriding letter and line spacing must not clip boxes.

### Medium

**M1 [medium] All-caps monospace for all UI and log text hurts readability, and the 4-letter abbreviations will be mispronounced. GAG "use simple, clear text formatting"; BDA dyslexia style guide; WCAG 3.1.4 Abbreviations (AAA, advisory).**
*Location:* DESIGN.md → Typography ("Interface copy is UPPER CASE … Event-log lines are upper case too"); EXPERIENCE.md → Voice and Tone, Component Patterns → Resource strip (EGG, LRVA, WRKR, STON, NECT).
All caps removes word shape, which slows reading and hurts dyslexic readers, and the event log is continuous reading. With +0.08–0.1em tracking and monospace, the cost compounds. For screen readers, real-caps strings like `WRKR`, `STON`, `NECT`, `LRVA`, `LV.3` and `6H 12M` are likely to be spelled out letter by letter. Some engines also spell short all-caps words as acronyms. CSS `text-transform` is not a cure: Chromium and WebKit expose the transformed text to assistive technology in some versions, so behaviour varies.
*Fix:*
- Author every string in sentence case and apply upper case with a CSS class.
- Add a "Readable text" setting: sentence case, no letter-spacing and, optionally, a proportional font for log and sheet body text. The grid applies only to boxes, meters and strips.
- Give every abbreviation an `aria-label` or visually hidden full word ("Workers", "Stone", "Nectar", "Larvae", "Level 3", "6 hours 12 minutes").
- Test with VoiceOver (iOS Safari) and TalkBack (Chrome) before E8.

**M2 [medium] The primary action's target changes under the player's thumb. GAG "avoid unexpected changes"; related to WCAG 3.2.2 / 3.2.5.**
*Location:* EXPERIENCE.md → Component Patterns → Primary action (priority order 1–4, re-chosen as state changes).
With 20 Hz ticks, the label can change between reading and tapping. Mid-hold, the repeat could switch from "ASSIGN GUARD" to "BUY WAREHOUSE". That is an irreversible spend with no undo. Screen-reader and low-vision users who read slowly are hit hardest.
*Fix:*
- The label may change at most once every 2 s.
- Taps within 400 ms of a label change are ignored, and the label shows a brief "changed" state.
- A hold locks to the target it started on.
- Announce label changes politely only when the primary action has focus.

**M3 [medium] The live-region policy is too narrow and leaves key moments silent. WCAG 4.1.3 Status Messages (AA).**
*Location:* EXPERIENCE.md → Accessibility Floor (only capacity, starving and guard met are announced).
Not covered: decision events arriving (and their timers), battle results, phase reveals and CONTINUE becoming available, the offline summary, toasts (`WAREHOUSE LV.3`), "newly affordable" `•` on tabs, new tabs appearing at Colony and Combat, and buy outcomes.
*Fix:* Add a table to the Accessibility Floor.
- **Polite:** toasts, buy results, battle result headline plus causal line, CONTINUE available, new tab revealed, new event line.
- **Throttled:** event lines, at most 1 announcement every 3 s, with a "Mute event announcements" option.
- **Dialogs (`role="dialog"`, focus moved):** decision events, offline summary, phase reveal text.
- **Timers:** announce once at start ("30 seconds"), again at 10 s and at expiry, never every second.
- The LOG tab uses `role="log"`.

**M4 [medium] The nest scene is "one image" but has tappable chambers inside it. WCAG 4.1.2 (A), 1.1.1 (A).**
*Location:* EXPERIENCE.md → Accessibility Floor (one labelled image), Component Patterns → Nest scene (tapping a chamber opens a sheet).
A `role="img"` cannot contain interactive children that assistive technology can reach.
*Fix:*
- Keep the scene as one `role="img"` with the summary label.
- Add an adjacent, visually hidden (or always-visible on desktop) list of chamber buttons ("Brood chamber: 5 eggs, 4 larvae") that opens the same sheets.
- Update the label only on threshold changes, not every tick.

**M5 [medium] Several tappable targets are under 24 px or unsized, and the map tiles contradict the spec's own 44 pt floor. WCAG 2.5.8 Target Size Minimum (AA); Apple HIG 44 pt, Material 48 dp.**
*Location:* EXPERIENCE.md → Component Patterns → Event line ("Tapping a line … jumps to it"), Accessibility Floor (44×44 pt, 8 px spacing, then tiles at 40 px with 1 px gaps); DESIGN.md → Components → Stepper multiplier row, FRONT segment row, resource-sheet gear.
- **Event lines:** 12 px at line-height 1.3 is about 16 px tall with no spacing, which fails 2.5.8.
- **Map tiles:** 40 px passes 2.5.8 AA, but the 1 px gap breaks the stated "8 px between adjacent targets" and the 44 pt floor. The mis-tap-only-selects mitigation is good, but the text is internally inconsistent.
- **Unsized:** the multiplier row (`[ ×1 ]  ×10  ×MAX`), segment row (`WAR · MAP · STARS`), chamber hit areas and the gear.
*Fix:*
- Make tappable event lines at least 44 px tall with padding, or make only a trailing `→` button tappable.
- Size the multiplier and segment controls at 44 px minimum.
- Give chambers a minimum 44 px hit area independent of drawn size.
- Restate tiles: "40 px tiles meet 2.5.8 AA; they are the one deliberate exception to the 44 pt floor, mitigated by select-then-confirm."
- Offer a "Large targets" setting that renders the map at 6 columns with panning.

**M6 [medium] Players can't find the decision-timer setting at the moment it matters. WCAG 2.2.1 Timing Adjustable (A) is met in principle, but in practice the first costly timeout arrives before players know the setting exists.**
*Location:* EXPERIENCE.md → Component Patterns → Decision event, Navigation rules (sheets never stack, so settings can't be opened from a decision sheet), Flow 6 (desktop tab left open).
The first "costly to ignore" event will expire on a player who reads slowly, uses a screen reader, or stepped away from a visible desktop tab. The background pause does not cover "visible but unattended".
*Fix:*
- Put a `MORE TIME (+30s)` secondary action on timed decision sheets (one use per event).
- Show a one-time line in the first timed sheet: `Timers can be doubled or turned off in settings.`
- Make the first costly event in a save untimed.
- Pause timers while a screen reader is active, if detectable, and when there has been no input for 60 s.

**M7 [medium] Reduced motion misses several animations, and the CRT toggle ignores OS contrast preferences. WCAG 2.3.3 (AAA, advisory), 2.2.2 (A); GAG "avoid motion sickness"; XAG 117.**
*Location:* EXPERIENCE.md → Game Feel & Juice → Reduced motion; DESIGN.md → Components → Transcendence ending, Elevation & Depth.
Not listed: the Transcendence break-apart and scatter (large full-screen motion, the worst vestibular trigger in the spec), floating `+N` text, the hatch "walks off into a chamber", the 2 s newly-affordable glow, the button invert, letter-by-letter DEFEAT/VICTORY, the strip-delta flash on short resume, and "the counter races" in the cinematic. Reduced motion does cover the cinematic: it opens on the logo, which the mock implements.
*Fix:*
- Extend the list: the Transcendence ending fades to the final line in 300 ms, `+N` appears static, hatching is instant, glow and invert are off, headlines appear whole, and nothing flashes.
- Default CRT effects off when `prefers-contrast: more` or `forced-colors: active`.
- In forced-colors mode, use `currentColor`/`CanvasText` and drop glow.

**M8 [medium] The selected map tile differs from claimed tiles only by stroke width in most phases. WCAG 1.4.1 Use of Color (A), 1.4.11 Non-text Contrast (AA).**
*Location:* DESIGN.md → Colors (`highlight`), Components → Map tile.
`highlight` against `accent` is 1.22:1 (Colony), 1.25:1 (Expansion) and 1.00:1 (Transcendence, both white). Selected (2.5 px white) versus claimed (1 px accent) is essentially a width cue. The same applies to "pending markers" and inline "new" emphasis.
*Fix:*
- Mark the selected tile with a shape change: corner brackets `⌜⌝⌞⌟` outside the tile, or an inverted fill, plus `aria-selected` / `aria-pressed`.
- Give "new" emphasis a text marker (`NEW` or `•`), not white alone.

**M9 [medium] Some non-text UI elements fall below 3:1. WCAG 1.4.11 Non-text Contrast (AA).**
*Location:* DESIGN.md → Components → Map tile (stroke accent @ 0.3: 1.66–2.46), Meter (empty cells in `line`: 1.48–2.03), Star map (locked planets at 35 %: 2.36).
Unclaimed tile outlines are the only visual cue for where a tile control is, and empty meter cells show the remaining range. Locked-planet names are text at 35 %: they are an exempt inactive component, but players still need to read them.
*Fix:*
- Raise the unclaimed tile stroke to at least 45–50 % (≥ 3:1 on every `bg`; check Combat first).
- Draw empty meter cells `·` in `dim`, not `line`. Keep `line` for rules only.
- Show locked planets in `dim` with a `LOCKED` label instead of 35 % opacity.

**M10 [medium] Map panning needs a non-drag alternative, and buys may fire on pointer-down. WCAG 2.5.7 Dragging Movements (AA), 2.5.2 Pointer Cancellation (A).**
*Location:* DESIGN.md → Layout ("Only the map and star map pan"); EXPERIENCE.md → Component Patterns → Map tile and Star map, Interaction Primitives (tap acts; hold repeats).
*Fix:*
- Add on-screen pan buttons (`[◄] [▲] [▼] [►]`), arrow keys on desktop and a "centre on home" control, or make the star map a list as well.
- For pointer cancellation, a single tap commits on `pointerup`, and sliding off cancels. Hold-repeat may start committing only after the hold threshold, which is an abortable down-action.
- Swipe-down dismissal already has alternatives (scrim tap, CLOSE). Keep a visible CLOSE in every non-decision sheet.

**M11 [medium] Phase 1 demands many repeated inputs, and the ×MAX alternative is not stated for LAY EGG. GAG "avoid repeated inputs"; XAG 107.**
*Location:* EXPERIENCE.md → Accessibility Floor ("every hold-repeat has a ×MAX equivalent"), Tabs (Phase 1 primary action LAY EGG), Interaction Primitives ("Banned: … repeated tapping after Phase 1").
Phase 1 is exactly where repeated tapping is allowed, and it is the player's first impression. Motor-impaired players need a sustained-input-free path there too.
*Fix:* State explicitly that LAY EGG has an `×MAX` (or `LAY 10`) option, or a "Lay continuously" toggle (tap to start, tap to stop) in Phase 1.

**M12 [medium] Glow on text lowers legibility for low-vision and astigmatic players.**
*Location:* DESIGN.md → Elevation & Depth ("soft text-shadow on accent text"); mocks use `text-shadow: 0 0 5–6px accent @ 45–55 %`.
The halo raises the local background luminance around strokes. In Combat, accent against a 30 % halo is 4.65:1, and the halo blurs 11–12 px glyph edges. This does not fail WCAG (the specified pair is measured), but it is the most common complaint about phosphor themes.
*Fix:* Limit text glow to `value`, `title` and `display` sizes (≥ 15 px). No glow on `meta`, `label` or `body`. Glow stays under the CRT toggle.

### Low

**L1 [low] The contrast claims are slightly wrong or razor-thin.**
*Location:* DESIGN.md → Colors → Contrast.
Accent on raised is 7.09 in Combat, not ≥ 7.1. `warn`/Colony-raised is 8.0012, and `dim`/raised is 4.606 in Combat and Egg. `color-mix()` rounding or sub-pixel antialiasing on 1.2–1.6 px strokes will drop the real values below the claims.
*Fix:* Restate the claims as "≥ 7.0:1" and "≥ 7.9:1", leave ≥ 0.3 headroom on every AA pair, and add a unit test that recomputes the table from the theme tokens.

**L2 [low] Disabled controls use 40 % opacity (2.11–3.66:1).**
WCAG exempts inactive components, but players still need to read what the button is.
*Location:* DESIGN.md → Components → Primary button.
*Fix:* Render disabled labels in `dim` (≥ 5:1) with a dashed `line` border, plus `aria-disabled="true"` and the reason in the accessible name (already specified).

**L3 [low] The mockups sit below the spec floor in places, so don't copy their values.**
*Location:* `terminal-variants.html` (`.tinfo span` accent 62 % mix, 3.54:1 in Combat); `glyphs.html` (10.5 px text); `title-cinematic.html` (click-only `div` skip, blink on `.tap`).
*Fix:* Add one line to the Mockups section: "Mock colours and sizes are illustrative; tokens in DESIGN.md frontmatter are normative."

**L4 [low] At large text sizes the strip becomes icons only, and glyph alt text can duplicate visible labels.**
*Location:* DESIGN.md → Typography ("labels drop first and glyphs stay"), Components → Glyphs (FOOD and VNOM are both drop-shaped).
*Fix:*
- When a label is visible, mark the glyph `aria-hidden`. It gets alt text only when it stands alone.
- At 200 %, wrap the strip to two rows instead of dropping labels.
- Fix VNOM before E8, as already noted in the spec.

**L5 [low] Landscape must not be blocked. WCAG 1.3.4 Orientation (AA).**
*Location:* EXPERIENCE.md → Responsive & Platform ("Phone landscape is not supported … stays portrait and centred").
The centred column is fine. The risks are a "rotate your device" block, or sheets and the pinned bar overflowing a viewport about 360 px tall.
*Fix:* State "no orientation lock, no rotate prompt". Content scrolls in landscape, and the pinned primary action un-pins when the viewport height is under 480 px.

**L6 [low] Coach marks are dismissed by "tapping anywhere", and some sheets rely on swiping.**
*Location:* EXPERIENCE.md → Component Patterns → Coach mark, Bottom sheet.
A tap that dismisses a coach mark must not also pass through and trigger the control underneath.
*Fix:* The dismiss tap is consumed. Coach marks are also exposed as a polite announcement and are focusable with a "Got it" button.

**L7 [low] Haptics and hover need small clarifications.**
*Location:* EXPERIENCE.md → Game Feel (haptic column), Interaction Primitives → Desktop hover.
The web Vibration API is not available in iOS Safari, so haptics will silently do nothing on iPhone. That is acceptable because every haptic has a visual twin, but the spec should say so. Hover content must meet WCAG 1.4.13 (dismissible with Esc, hoverable, persistent).
*Fix:* Add "Haptics are an enhancement; never the only feedback" next to the existing audio rule. Add the 1.4.13 requirement to the desktop hover line. Consider separate volume controls for effects and chimes.

**L8 [low] Combat `accent` and `warn` are 1.23:1 apart, and the strip deltas lean on a 12 px minus sign.**
*Location:* DESIGN.md → Colors ("Hue never carries meaning alone"), Components → Resource strip (`+18/s` in `dim`, negatives in `warn`).
The rule is right and well specified for event and sheet text. In the strip, though, a negative delta's only non-colour cue is `−` versus `+` at 12 px.
*Fix:*
- Prefix negative strip deltas with `▼` (`▼4/s`), matching the stated rule.
- Make the minus a true U+2212 so it reads as "minus".
- Add a lint or unit check that any `warn`-coloured element also contains `−`, `▼`, `▲` or a word.

## What's already good (keep)

- Hue is never the only carrier of meaning, and the mitigation is designed in rather than bolted on.
- Three-tier ignore policy. Unavoidable events have no timer. Timers ×2 or off. Background pause.
- Reduced motion takes the cinematic to the logo (implemented in the mock via `matchMedia`). The cinematic is skippable and plays only once, with "replay intro" in settings.
- Sound is off by default, audio is never the only channel, and notifications are opt-in.
- No numeric badges, no claim timers, no streaks. These are cognitive-load wins (GAG).
- Map tile select-then-confirm: a mis-tap never commits.
- The exact integer always sits beside the drawn population, which gives screen-reader and low-vision parity with the scene.
