import { configDefaults, defineConfig } from 'vitest/config';

/**
 * Tests that run a real Vite build. The bundler's native bindings fail type checks
 * inside a vmThreads VM context, so these run in plain child processes instead.
 */
const BUILD_TESTS = ['tests/unit/debug/productionBuild.test.ts'];

export default defineConfig({
  test: {
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/**/*.test.{ts,tsx}'],
          // vmThreads builds one jsdom per worker and gives each test file a fresh
          // VM context (fresh module graph, so singletons like gameState are still
          // per-file). Creating a jsdom per file was ~80% of unit-test wall time.
          pool: 'vmThreads',
          exclude: [...configDefaults.exclude, ...BUILD_TESTS],
        },
      },
      {
        extends: true,
        test: { name: 'build', pool: 'forks', environment: 'node', include: BUILD_TESTS },
      },
    ],
  },
});
