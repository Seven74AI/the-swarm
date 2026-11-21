# 0041. Swarm Mono: one shipped font, six type roles

- **Status:** accepted (2026-11-21)
- **Source:** DESIGN.md *Typography* · Story 8.1 (#309) · UX-DR2 · ADR 0022 (character grid) · ADR 0031 (PWA)

## Context

The terminal UI is a character grid: meters, boxes and strip cells are counted in characters. Phone system
monospace fonts draw box drawing, block elements and symbols such as `✓ ▲ •` from other fonts at other widths,
so the grid broke on some phones. The styles also used about twenty ad-hoc font sizes, a few below 12 px.

## Decision

- **"Swarm Mono" is a subset of JetBrains Mono NL 2.242** (SIL OFL 1.1, no Reserved Font Name; the NL cut has no
  ligatures, so `->` stays two cells). Regular and bold, WOFF2, in `public/fonts/` with `OFL.txt` beside them.
  `scripts/swarm-mono.sh` rebuilds them with fontTools' pyftsubset from the npm package `jetbrains-mono@1.0.6`
  (checked by sha256): ASCII, Latin-1, the marks and arrows the copy uses, box drawing, block elements and
  geometric shapes; no hinting, no OpenType features. Both files together are about 21 KB.
- **The files are public assets, not hashed imports,** so `index.html` can preload both weights by a fixed URL and
  the licence ships next to them. Vite prefixes the base path; the service worker precaches them (the workbox glob
  covers `woff2` and `txt`).
- **One font stack, `--font-mono`** (`src/ui/styles/typography.css`): Swarm Mono first, system monospace only as
  the fallback. Every `font-family` in `src/` is `var(--font-mono)` or `inherit`. `font-display: swap`.
- **Six type roles as custom properties in rem:** `--type-display` 24, `--type-title` 20, `--type-value` 15,
  `--type-body` 14, `--type-aside` 13, `--type-meta` 12 (px at the default text size). Every `font-size` in the
  styles is a role (or `min(role, Nvw)`); the only exceptions are drawings sized by font size (the hold ring's
  cells, the narrow sheet handle). `meta` is for upper-case text only: sentence-case text uses `aside` or larger.
  Text glow (`text-shadow`) only on `value` and larger.

## Consequences

- `tests/unit/ui/swarmMono.test.ts` reads the WOFF2 files (`tests/unit/helpers/woff2.ts`, a minimal reader on
  node:zlib's Brotli) for coverage, one advance width, weight, size budget and licence, and checks the font stack
  and preloads. `tests/unit/ui/typeRoles.test.ts` checks the roles, that every size is a role, and the glow rule.
  `tests/e2e/typography.spec.ts` checks that the font loads and draws one width on screen, and walks the rendered
  text of every tab and the resource and settings sheets for the 12 / 13 / 15 px rules.
- New CSS sets sizes with `var(--type-…)` and fonts with `var(--font-mono)`. A new character the copy needs must be
  in the subset (`UNICODES` in the script), or it falls back to a system font at another width.
- The goal conditions and the resource sheet's source lines are sentence case, so they moved from 12 px to `aside`.
