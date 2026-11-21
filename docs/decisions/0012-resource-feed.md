# 0012. One sampled resource feed drives the strip and the resource sheet

- **Status:** accepted (2026-11-21)
- **Source:** [Game architecture](../../_bmad-output/planning-artifacts/architecture/architecture-the-swarm-2026-11-20/game-architecture.md)
  `ui/shell/` · Story 1.16 (#246) · UX-DR7, UX-DR8

## Context

The strip must refresh at most 4 times a second, while the game writes state 20 times a second. It shows a
per-second delta for every resource it can hold, and the resource sheet shows the same rates. The analytical rate
model (`computeResourceRates`) covers food, wood, stone and nectar only; eggs, larvae and workers move through
pipelines, silk, chitin and venom come from battle loot, and the space resources from conversions.

## Decision

- **`src/ui/shell/resourceFeed.ts`** (`createResourceFeed()`) is one sampler shared by the strip and the sheet.
  While anyone holds it (`retain()` returns the release; readers share one timer), it reads the selectors every
  `REFRESH_MS` (250 ms) and publishes one `ResourceSnapshot` signal: every resource with its integer amount,
  rate, cap and unlock status. Components read only that signal, so the 4 Hz limit holds by construction.
- **Rates are measured, not modelled:** the change of each amount over the last `RATE_WINDOW_MS` (4 s) of **game
  time** (`stats.playTimeMs`), per second, truncated toward zero. This covers every resource the same way, counts
  consumption, and stays right across offline catch-up (which advances game time). A pause freezes the window. If
  game time runs backwards or the phase goes back (a new run, a loaded save, a prestige), the window starts over.
- **`src/ui/shell/resourceCatalog.ts`** lists the 14 resources (4-letter label, full name, source, unlock phase,
  placeholder glyph) and the strip's base set per phase. A resource is unlocked from its phase, or as soon as the
  colony holds some. Only workers have a cap (the effective nest capacity).
- **`stripCells(snapshot, count)`** orders the strip: the phase set in Phases 1 and 2; from Phase 3, and whenever
  the strip is narrowed to 3 cells (text scale above 125%), capped or falling resources first.
- `formatDelta` (strip, at most 5 characters with the sign, U+2212 minus) and `formatDeltaFull` (sheet) join
  `utils/format.ts`.

## Consequences

- A rate reacts to a change within one refresh and settles over the 4 s window; a slow trickle under 1/s reads `0`.
- Glyphs are typed placeholders until Story 8.2 swaps in the `Glyph<Name>` components (catalog field `glyph`).
- The `• SAVE FAILED` marker (UX-DR33) is not part of this story; it will sit in the strip.
