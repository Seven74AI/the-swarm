import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    // vmThreads builds one jsdom per worker and gives each test file a fresh
    // VM context (fresh module graph, so singletons like gameState are still
    // per-file). Creating a jsdom per file was ~80% of unit-test wall time.
    pool: 'vmThreads',
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
    },
  },
});
