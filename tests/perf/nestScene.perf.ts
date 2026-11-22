import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { build, preview, type PreviewServer } from 'vite';
import { chromium, devices, type Browser, type Page } from '@playwright/test';
import { SaveManager } from '../../src/persistence/SaveManager';

/**
 * `pnpm perf` (Story 8.6, AR14, NFR2): the nest scene's frame time with a
 * colony of several thousand, against the 16 ms budget. Not part of CI
 * (vitest.perf.config.ts): timing flakes on shared runners.
 *
 * It builds the game as deployed (production) plus a harness page that draws
 * the nest scene alone (tests/perf/harness/nest.html), serves both with
 * `vite preview`, and opens them in Chromium as a phone (Pixel 7 viewport and
 * pixel ratio) with the CPU slowed by `Emulation.setCPUThrottlingRate`
 * (default 4x, roughly the reference phone, a 2022 mid-range Android, against
 * a desktop core). Each frame's main-thread time runs from the frame's start
 * (the rAF timestamp) to the task after its rendering (a MessageChannel
 * message posted from rAF). It reports p50, p95 and max for:
 *
 * - the scene alone, thousands of ants: the scene frame time AR14's trigger
 *   is about (asserted here, never in CI);
 * - the scene alone, a small colony with no cloud, for comparison;
 * - the whole game on NEST, and on LOG (no scene on screen), for context: the
 *   game's own tick and UI work land in the same frames.
 *
 * AR14's fallback trigger: if the scene's p95 exceeds 16 ms on the reference
 * phone, the dot cloud moves to Canvas 2D. On a desktop with throttling the
 * numbers are an estimate; run it against the phone's own Chrome through
 * remote debugging for the real figure.
 *
 * Environment: `PERF_CHROMIUM` (a Chromium executable, else Playwright's own),
 * `PERF_CPU_THROTTLE` (default 4), `PERF_PORT` (default 5199),
 * `PERF_SECONDS` (measuring time per case, default 10).
 */

const ROOT = resolve(import.meta.dirname, '../..');
const OUT_DIR = 'dist-perf';
const PORT = Number(process.env.PERF_PORT ?? 5199);
const THROTTLE = Number(process.env.PERF_CPU_THROTTLE ?? 4);
const SECONDS = Number(process.env.PERF_SECONDS ?? 10);
const BUDGET_MS = 16;
const SETTLE_MS = 2000;
const BASE = `http://localhost:${PORT}/the-swarm/`;

const BIG = { workers: 5_000, eggs: 1_200, larvae: 500 };
const SMALL = { workers: 30, eggs: 10, larvae: 5 };

/** The game seeded with the big colony: both chambers clouded, food enough that nobody starves while it runs. */
const COLONY = {
  phase: 'colony',
  resources: { ...BIG, food: 10_000_000, nestCapacity: 1_000_000, wood: 0, stone: 0, nectar: 0 },
  workersAssigned: { gather: BIG.workers, tend: 0, dig: 0, guard: 0, researchers: 0 },
  eggPipeline: { count: BIG.eggs, progress: 0 },
  larvaPipeline: { count: BIG.larvae, progress: 0 },
};

interface Result {
  readonly frames: number;
  readonly p50: number;
  readonly p95: number;
  readonly max: number;
  readonly long: number;
  readonly ants: number;
  readonly dots: number;
}

let server: PreviewServer;
let browser: Browser;
const report: string[] = [];

beforeAll(async () => {
  await build({
    root: ROOT,
    mode: 'production',
    logLevel: 'warn',
    build: { outDir: OUT_DIR, rolldownOptions: { input: { main: 'index.html', perfNest: 'tests/perf/harness/nest.html' } } },
  });
  server = await preview({ root: ROOT, logLevel: 'warn', build: { outDir: OUT_DIR }, preview: { port: PORT, strictPort: true } });
  browser = await chromium.launch({
    executablePath: process.env.PERF_CHROMIUM || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}, 300_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
  process.stdout.write(`${report.join('\n')}\n`);
});

const pct = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];

/** Open `url` as a throttled phone, wait for `ready`, then record frame times. */
async function measure(url: string, ready: string, prepare?: (page: Page) => Promise<void>): Promise<Result> {
  const context = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await context.newPage();
  await prepare?.(page);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  await page.goto(url);
  await page.locator(ready).first().waitFor({ state: 'attached', timeout: 60_000 });
  const ants = await page.locator('[data-scene="nest"] [data-scene-part="worker"]').count();
  const dots = (
    await page
      .locator('[data-scene="nest"] [data-scene-part="cloud"]')
      .evaluateAll((ps) => ps.map((p) => (p.getAttribute('d')?.match(/M/g) ?? []).length))
  ).reduce((a, b) => a + b, 0);
  const { work, gaps } = await page.evaluate(
    ([settle, ms]) =>
      new Promise<{ work: number[]; gaps: number[] }>((done) => {
        const work: number[] = [];
        const gaps: number[] = [];
        const channel = new MessageChannel();
        const starts: number[] = [];
        let measuring = false;
        let last = 0;
        channel.port1.onmessage = () => {
          const start = starts.shift();
          if (measuring && start !== undefined) work.push(performance.now() - start);
        };
        const frame = (ts: number) => {
          if (measuring && last) gaps.push(ts - last);
          last = ts;
          starts.push(ts);
          channel.port2.postMessage(0);
          requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
        setTimeout(() => {
          measuring = true;
          setTimeout(() => {
            measuring = false;
            done({ work, gaps });
          }, ms);
        }, settle);
      }),
    [SETTLE_MS, SECONDS * 1000] as const,
  );
  await context.close();
  const sorted = [...work].sort((a, b) => a - b);
  return {
    frames: sorted.length,
    p50: pct(sorted, 50),
    p95: pct(sorted, 95),
    max: sorted[sorted.length - 1],
    long: gaps.filter((g) => g > 1.5 * (1000 / 60)).length,
    ants,
    dots,
  };
}

function line(name: string, r: Result): string {
  const over = r.p95 > BUDGET_MS ? '  OVER BUDGET' : '';
  const ms = (n: number) => n.toFixed(1).padStart(5);
  return `[perf] ${name.padEnd(36)} p50 ${ms(r.p50)} ms  p95 ${ms(r.p95)} ms  max ${ms(r.max)} ms  frames ${r.frames}, long ${r.long}; ${r.ants} ants, ${r.dots} dots${over}`;
}

const harness = (v: typeof BIG) => `${BASE}tests/perf/harness/nest.html?workers=${v.workers}&eggs=${v.eggs}&larvae=${v.larvae}`;

const seedGame = async (page: Page): Promise<void> => {
  await page.addInitScript(
    (save) => {
      localStorage.setItem('the_swarm_save', save);
      localStorage.setItem('the_swarm_onboarding', 'complete');
      localStorage.setItem('the_swarm_home_hint', 'seen');
    },
    JSON.stringify({ version: SaveManager.SAVE_VERSION, timestamp: Date.now(), playTimeMs: 0, gameState: COLONY }),
  );
};

describe(`nest scene frame time at ${THROTTLE}x CPU throttling (pnpm perf, not CI)`, () => {
  it(`the scene alone with thousands of ants: p95 within ${BUDGET_MS} ms`, async () => {
    report.push(`[perf] nest scene frame time, Pixel 7 viewport, CPU ${THROTTLE}x, ${SECONDS} s a case (budget: p95 <= ${BUDGET_MS} ms)`);
    const small = await measure(harness(SMALL), '[data-scene-part="worker"]');
    const big = await measure(harness(BIG), '[data-cloud="workers"]');
    report.push(line(`scene alone, ${SMALL.workers} workers (no cloud)`, small));
    report.push(line(`scene alone, ${BIG.workers} workers (cloud)`, big));
    if (big.p95 > BUDGET_MS) report.push('[perf] AR14: the scene is over budget: move the dot cloud to Canvas 2D');
    expect(big.dots).toBeGreaterThan(0);
    expect(big.p95).toBeLessThanOrEqual(BUDGET_MS);
  }, 120_000);

  it('the whole game with the same colony, on NEST and on LOG (for context, not the budget)', async () => {
    const nest = await measure(BASE, '[data-scene="nest"] [data-cloud="workers"]', seedGame);
    const log = await measure(BASE, '[data-tab="log"][aria-selected="true"]', async (page) => {
      await seedGame(page);
      await page.addInitScript(() => {
        // Open LOG once the shell is up, so the nest scene is off screen.
        const open = () => {
          const tab = document.querySelector<HTMLElement>('[data-tab="log"]');
          if (tab) tab.click();
          else requestAnimationFrame(open);
        };
        addEventListener('DOMContentLoaded', open);
      });
    });
    report.push(line(`game on NEST, ${BIG.workers} workers`, nest));
    report.push(line(`game on LOG, ${BIG.workers} workers`, log));
    expect(nest.dots).toBeGreaterThan(0);
  }, 120_000);
});
