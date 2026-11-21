# 0031. PWA: precache everything, updates wait for a cold start

- **Status:** accepted (2026-11-21)
- **Source:** Story 2.13 (#279) · AR13 · arch D10 · NFR6, NFR10 · ADR 0004, 0007

## Context

The game must open and play with no connection (NFR10) and load later launches from cache (NFR6). It deploys to
GitHub Pages under `/the-swarm/`. A session must never be reloaded under the player, so an update can't take over
mid-session. AR25 allows "the PWA runtime" as a dependency.

## Decision

- **vite-plugin-pwa 2.x** (peer range covers Vite 8) as a **dev dependency**: it runs at build time only
  (`generateSW`). No runtime dependency is added: the game registers the worker itself, so `workbox-window` is not
  shipped. A pnpm override moves `workbox-build`'s `glob` to 14 (the version it asks for carries moderate
  advisories); drop it when workbox-build moves on.
- **Manifest:** `display: standalone`, `orientation: portrait`, `start_url` and `scope` `/the-swarm/`, the Egg
  Laying background as splash and theme colour, PNG icons 192/512 (512 also maskable) and an SVG, in
  `public/icons/` (drawn from `public/icons/icon.svg`).
- **Precache every emitted file** (one glob over the build plus the manifest), with `index.html` as the navigation
  fallback, so a cold start offline opens the game. `tests/unit/build/pwaBuild.test.ts` builds production and fails
  on any emitted file missing from the precache list, on a duplicate entry, or on `clientsClaim` / an unconditional
  `skipWaiting`.
- **Updates wait for a cold start:** `registerType: 'prompt'` (no `skipWaiting`, no `clientsClaim`). Nothing in
  the game posts `SKIP_WAITING`, listens for `controllerchange`, or reloads. A new version activates once no page of
  the old one is open. When one is waiting, main shows a toast once per session (a reload is not a cold start, so it
  shows again after one). A return to the app (`platform.lifecycle` `returned`) calls `registration.update()`, so a
  PWA left open for days still finds a deploy.
- **Registration is a platform service:** `platform.serviceWorker` (`src/platform/serviceWorker.ts`:
  `register({enabled, url, scope, onUpdateReady, onError})`, `checkForUpdate()`), called by main.
  `serviceWorkerWanted({prod, search})` is true in production builds; dev and E2E builds register only with `?sw=1`,
  so the dev server and every other E2E spec run without a worker. `tests/e2e/offline-pwa.spec.ts` uses `?sw=1`
  against the E2E bundle: offline reload, offline cold start, an update that waits, and no worker without the flag.

## Consequences

- A player who keeps the app open never gets the update until they close it; the toast tells them.
- A new emitted file type outside the glob fails the build test, not production.
- E2E simulates a deploy with a new script URL for the same scope (Playwright can't route the browser's fetch of a
  worker script).
