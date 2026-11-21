import { defineConfig } from 'vite';

export default defineConfig({
  base: '/the-swarm/',
  // The build named in exported diagnostics (Story 1.27): the commit in CI, `dev` locally.
  define: {
    __BUILD_ID__: JSON.stringify((process.env.GITHUB_SHA ?? 'dev').slice(0, 7)),
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
