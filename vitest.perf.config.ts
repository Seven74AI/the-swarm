import { defineConfig } from 'vitest/config';

/**
 * `pnpm perf` (Story 2.6, NFR4): timing reports, never part of CI. Wall-clock
 * budgets flake on shared runners, so CI asserts step budgets instead
 * (tests/unit/engine/catchUpBudget.test.ts).
 */
export default defineConfig({
  test: {
    name: 'perf',
    environment: 'node',
    include: ['tests/perf/**/*.perf.ts'],
    pool: 'forks',
    testTimeout: 120_000,
  },
});
