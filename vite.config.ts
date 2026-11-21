import { defineConfig } from 'vite';

// E2E_BUILD=1 adds the Playwright harness pages to the build, so the E2E
// suite can run against a bundled `vite preview` server instead of the dev
// server. Never set for the Pages deploy.
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
