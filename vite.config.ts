import { defineConfig } from 'vite';

// E2E_BUILD=1 builds what the E2E suite runs against (served by `vite preview`):
// a development-mode bundle (import.meta.env.DEV, so dev cheats and dev logging
// are in, as on the dev server) that is not minified (CSS values stay as written),
// plus the Playwright harness pages. Bundled pages load far faster than the dev
// server's per-module transforms. Never set for the Pages deploy.
const e2eBuild = process.env.E2E_BUILD === '1';

export default defineConfig({
  base: '/the-swarm/',
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
