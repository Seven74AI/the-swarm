# 0004. Preact for the UI, web-first PWA, optional Capacitor

- **Status:** accepted (2026-11-21)
- **Source:** [Game architecture](../../_bmad-output/planning-artifacts/architecture/architecture-the-swarm-2026-11-20/game-architecture.md) Engine & Framework, D9, D10

## Context

The prototype renders 23 vanilla-DOM panels. The rework consolidates them into 5 tabs, sheets and overlays with an
accessibility floor. The game is mostly text plus an ambient vector scene. Game engines (Godot, Unity web, Phaser as
the main renderer) were rejected: heavy payloads, weaker mobile-web performance, poor accessibility for text, and a
full rewrite.

## Decision

- Keep TypeScript + Vite 8 + `@preact/signals-core`; add Preact 11 + `@preact/signals` for the UI layer, migrated
  panel by panel. Exactly one `signals-core` instance must be installed.
- Scenes are SVG components with HTML labels; Canvas 2D (then PixiJS) only if measured frame time requires it.
- Ship as a PWA on GitHub Pages (vite-plugin-pwa, precache everything, update on next cold start,
  `display: standalone`). A Capacitor store build is optional and later.
- Platform services (audio, haptics, notifications, storage, lifecycle) sit behind interfaces in `src/platform/`.
  The web build has no notifications.

## Consequences

- New runtime dependencies need an ADR.
- Nothing may depend on the native wrapper, and nothing may rule it out.
