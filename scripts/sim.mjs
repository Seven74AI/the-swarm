// `pnpm sim` (Story 3.9, AR15): play a fresh game headless and print the
// pacing report against the GDD targets. Not part of CI: the numbers are for
// tuning (Story 3.11), never asserted.
//
//   pnpm sim                    # first-week schedule, 10 days (src/data/balance/pacing.ts)
//   pnpm sim --seed 3 --days 10
//
// The game code reads `import.meta.env`, so it is loaded through Vite's module
// runner (no extra dependency). Catch-up logs an info line per resume: silenced.
import { runnerImport } from 'vite';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return undefined;
  const n = Number(process.argv[i + 1]);
  if (!Number.isInteger(n) || n < 0) {
    console.error(`--${name} needs a whole number`);
    process.exit(2);
  }
  return n;
}

const seed = arg('seed');
const days = arg('days');
console.info = () => {};
const { module } = await runnerImport('/src/sim/report.ts', { configFile: false, root: process.cwd(), logLevel: 'error' });
console.log(module.formatPacingReport(module.runPacingReport({ seed, days })));
