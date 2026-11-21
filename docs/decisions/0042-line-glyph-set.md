# 0042. The line glyph set, and no emoji in src/

- **Status:** accepted (2026-11-21)
- **Source:** Story 8.2 (#310) · FR43 (icons), UX-DR35, NFR11 · DESIGN.md "Glyphs"

## Context

The strip, the resource sheet, cost lines and BUILD's cards drew typed placeholder characters (`◊`, `△`, `⚗`) as
icons, and the older panels (prestige, space, expeditions, the top bar) still used emoji. Emoji ignore the phase
palette, render differently on every platform and break the terminal look. NFR11 allows no binary art and no emoji.

## Decision

- **One glyph set in `src/ui/glyphs/`:** 20 `Glyph<Name>` TSX components, one per resource (14) and per building
  (6; 9 since Tunnels, the Fungus Garden and the Midden joined BUILD in Epic 4, so 23 in all), plus `GlyphGear` for `[ SETTINGS gear ]`. `RESOURCE_GLYPHS` (by `ResourceId`) and `BUILDING_GLYPHS` (by
  `BuildingType`) map ids to them. The catalogs point at these: `ResourceDef.glyph` and `BuildingCardDef.glyph`
  are components (`<def.glyph />`), and `GEAR_GLYPH` is `GlyphGear`.
- **One frame:** `GlyphFrame` draws every glyph on a 24×24 `viewBox` with `fill="none"`, a 1.6 stroke in
  `currentColor`, round caps and joins. No glyph sets its own colour or stroke width; a shape may fill with
  `currentColor` only (dark matter's shadow). So every glyph repaints with the phase like the text around it.
- **Decorative only:** each SVG is `aria-hidden="true"` and `focusable="false"`, with no title. A glyph always sits
  next to a visible label or a `.visually-hidden` name; inline in text use `ResourceGlyph({id})`
  (`ui/build/cost.tsx`), which draws the glyph and gives the resource's full name to assistive tech.
- **Size follows text:** `.glyph` is `var(--glyph-size, 1.15em)` square; each place sets `--glyph-size` in rem
  (strip 15 px, cost lines 14 px, card titles 20 px, resource sheet 30 px), so glyphs scale with the player's text size.
- **VNOM is a pair of fangs,** so it can't be read as FOOD's drop. The unit test checks the two share no shape.
- **No emoji anywhere in `src/`:** `tests/arch/noEmoji.test.ts` reads every file (code, comments, strings, CSS) and
  fails on any `Extended_Pictographic` or `Emoji_Presentation` code point, regional indicators, skin-tone
  modifiers, the keycap combiner, ZWJ and the presentation selectors U+FE0E/U+FE0F. Typed terminal marks (`·`, `→`,
  `▲`, `▸`, `△`, `✗`, `▷`, `‖`) are not emoji and stay allowed.
- Research, the Particle Lab and the converter are not in the 20 and keep typed geometric characters. The legacy
  Phase 4–6 panels (until Epic 6) use plain words and typed marks instead of emoji.

## Consequences

- A new resource or building needs a glyph in `RESOURCE_GLYPHS` / `BUILDING_GLYPHS` (the maps are typed by id, and
  `tests/unit/ui/glyphs/glyphs.test.tsx` checks they match the catalogs).
- `Button.verb` accepts components (text with an inline glyph); pass `label` so the accessible name stays words.
- The pause button shows `▷` / `‖` (`PLAY_SIGN`, `PAUSE_SIGN` in `TopBar.tsx`). Prestige upgrades lost their
  `icon` field; the prestige count stat is labelled "Prestige Count".
