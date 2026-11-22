# 0048. The title cinematic, the intro flag and the first coach mark

- **Status:** accepted (2026-11-22)
- **Source:** Story 8.10 (#318) · UX-DR28, UX-DR29 · EXPERIENCE.md Flow 1 and State Patterns (First launch) ·
  `mockups/title-cinematic.html` · ADR 0007 (settings), ADR 0014 (overlay layer), ADR 0026 (intro flag behind
  platform/), ADR 0043 (only the phase palette), ADR 0046 (CRT surfaces)

## Context

The first launch opened on the legacy tooltip onboarding (`OnboardingManager` + `OnboardingTooltip`, a dimming
backdrop and three tips, one pointing at panels Phase 1 doesn't show) behind the flag `the_swarm_onboarding`.
UX-DR28 asks for a ~11 s title cinematic on first launch (no save and no intro flag, its own key), Phase 1 amber
only, skippable, ending on a real `[ TAP TO WAKE THE QUEEN ]` button, then `A QUEEN, ALONE.`, the brood chamber and a
coach mark on LAY EGG. ADR 0025 already said Story 8.10 replaces the tooltips with coach marks.

## Decision

- **Intro flag** (`platform/storage/introFlag.ts`, `platform.introFlag`): key `the_swarm_intro_seen`, value `seen`.
  The legacy `the_swarm_onboarding` key (any value) reads as seen: that device has started the game before. It is
  never written again; `reset()` clears both.
- **`ui/overlays/TitleCinematic.tsx`**: overlay kind `title-cinematic`. `bindTitleCinematic({ overlays, flag, hasSave,
  reducedMotion, onWoken })` (main, after the UI is mounted) plays it when there is no save (`opened.status ===
  'empty'`) and the flag is not set, **setting the flag before it shows**, so a cinematic left mid-way never plays by
  itself again. It returns `replay()` for settings → REPLAY INTRO, which closes the sheet and plays it without
  touching the save or the flag.
  - Stages `playing → title → alone` (`data-stage`). A tap, Enter, Space, Esc or the `SKIP INTRO` button skips to
    the title frame; it never ends by itself there. The wake button (and Enter, Space, Esc) shows
    `A QUEEN, ALONE.` for `aloneMs`; then the overlay ends and `onWoken` asks the coach host for the LAY EGG mark.
    Every key is swallowed (capture phase), like the phase reveal. Reduced motion opens on the title frame, still.
  - Words and beats are content: `data/content/titleCinematic.ts` (`TITLE_COPY`, `TITLE_BEATS` in `…Ms`).
  - **Phase 1 only:** the overlay carries `data-palette="egg"`, a selector of the Phase 1 block in `tokens.css`, so
    it is amber whatever the phase (a replay). The CRT tokens derived from the aliases are redeclared on
    `[data-palette]` (`crt.css`), so its glow and scanlines are amber too.
  - It is a CRT scene surface; its drawings are line-work.
- **Drawings** (`ui/scene/TitleScene.tsx`, `ui/scene/TitleLogo.tsx`): pure functions of the moment (`ms`), no game
  state, no `Math.random` (a fixed sequence places the colony). The logo is drawn as block cells in an SVG inside the
  `THE SWARM` heading, so it fits any width and text size; screen readers get the words.
- **Coach mark host** (`ui/shell/CoachHost.tsx`): `createCoach()` → `show({ concept, text, target })`; App draws the
  one requested `CoachMark` for the element the selector finds. The coach mark caption now sits above a target in
  the lower half of the screen (LAY EGG is in the primary zone).
- **The tooltip onboarding is removed** (`ui/OnboardingManager.ts`, `ui/OnboardingTooltip.ts`, their CSS and tests;
  `tests/arch/architecture.test.ts` keeps them gone).
- **The opening chronicle line stays** `A QUEEN WAKES ALONE IN THE DARK.` (Story 4.9's Phase 1 entry beat, written
  to the log and checked by `narrative-events.spec.ts`). `A QUEEN, ALONE.` is the cinematic's wake line, shown on the
  overlay: the first-launch counterpart of the prestige line `A QUEEN, AGAIN.`.

## Consequences

- E2E: every Playwright project starts with `the_swarm_intro_seen` in its `storageState` (`playwright.config.ts`),
  so specs without a save never meet the cinematic. `tests/e2e/helpers/seed.ts` `seedSave(page, state, { introSeen })`
  seeds a well-formed save (or none, `null`) and the flag; `title-cinematic.spec.ts` clears the storage state.
- A player whose save was lost but who has the flag lands in the brood chamber without the cinematic or the coach
  mark; REPLAY INTRO is in settings.
