import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// E2E_BUILD=1 builds what the E2E suite runs against (served by `vite preview`):
// a development-mode bundle (import.meta.env.DEV, so dev cheats and dev logging
// are in, as on the dev server) that is not minified (CSS values stay as written),
// plus the Playwright harness pages. Bundled pages load far faster than the dev
// server's per-module transforms. Never set for the Pages deploy.
const e2eBuild = process.env.E2E_BUILD === '1';

// The Egg Laying palette (src/ui/styles/tokens.css): the splash and the status bar
// match the first screen a player sees.
const SPLASH_BG = '#0d0a04';

export default defineConfig({
  base: '/the-swarm/',
  plugins: [
    // Story 2.13 (AR13, D10): an installable PWA that plays offline. The service
    // worker precaches every emitted asset. A new version waits for the next cold
    // start (registerType 'prompt': no skipWaiting, no clientsClaim) and the game
    // never asks it to skip waiting, so a session is never reloaded under the player.
    // main registers the worker itself through platform/serviceWorker.ts, in
    // production builds only (injectRegister: false).
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      // The workbox glob below already precaches public/ (icons included), once.
      includeManifestIcons: false,
      manifest: {
        id: '/the-swarm/',
        name: 'THE SWARM',
        short_name: 'THE SWARM',
        description: 'An incremental game: from one ant queen to a swarm among the stars.',
        lang: 'en',
        start_url: '/the-swarm/',
        scope: '/the-swarm/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: SPLASH_BG,
        theme_color: SPLASH_BG,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        // Every emitted file (the plugin adds the manifest itself), harness pages and the debug chunk included.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2,json}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        skipWaiting: false,
        clientsClaim: false,
      },
    }),
  ],
  // The build named in exported diagnostics (Story 1.27): the commit in CI, `dev` locally.
  define: {
    __BUILD_ID__: JSON.stringify((process.env.GITHUB_SHA ?? 'dev').slice(0, 7)),
  },
  build: {
    outDir: e2eBuild ? 'dist-e2e' : 'dist',
    sourcemap: false,
    ...(e2eBuild && {
      minify: false,
      cssMinify: false,
      rolldownOptions: {
        input: {
          main: 'index.html',
          harnessButton: 'tests/e2e/harness/button.html',
          harnessPrimitives: 'tests/e2e/harness/primitives.html',
        },
      },
    }),
  },
});
