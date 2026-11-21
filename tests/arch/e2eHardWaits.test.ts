// @vitest-environment node
/**
 * Ratchet, #369: E2E tests wait for an outcome, not for the clock.
 *
 * `page.waitForTimeout(ms)` sleeps a fixed time: too short on a slow runner
 * (flaky), too long everywhere else (slow). Wait for what the test needs
 * instead: a web-first assertion, `expect.poll(...)`, or, for game time,
 * `page.clock.pauseAt(...)` + `runFor(...)` (see CLAUDE.md, Testing gotchas).
 *
 * `KNOWN_HARD_WAITS` lists the files that still sleep and how many times: only
 * tests whose subject is a duration (a repeat rate, a fade's timing).
 * Counts may only go down: lower one when you remove a wait, and remove the
 * entry at zero. A new file never gets an entry.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findInCode, listSources, type SourceFile } from './scan';

const E2E = resolve(dirname(fileURLToPath(import.meta.url)), '../e2e');

const KNOWN_HARD_WAITS: Readonly<Record<string, number>> = {
  // These measure elapsed time itself: the hold-repeat rate after 1 s of holding.
  'button-primitive.spec.ts': 2,
  // These sample a 3 s palette cross-fade at its middle, and check the reduced-motion fade is over by 700 ms.
  'phase-transition.spec.ts': 2,
};

const HARD_WAIT = /\bwaitForTimeout\s*\(/g;

/** `waitForTimeout(` calls per file, outside comments and strings. Files with none are left out. */
export function hardWaitCounts(files: readonly SourceFile[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of files) {
    const n = findInCode(f.text, HARD_WAIT).length;
    if (n > 0) counts[f.rel] = n;
  }
  return counts;
}

describe('E2E hard waits (#369)', () => {
  const counts = hardWaitCounts(listSources(E2E));

  it('no E2E file sleeps more than its known count', () => {
    const grown = Object.entries(counts)
      .filter(([rel, n]) => n > (KNOWN_HARD_WAITS[rel] ?? 0))
      .map(
        ([rel, n]) =>
          `${rel}: ${n} waitForTimeout call(s), ${KNOWN_HARD_WAITS[rel] ?? 0} allowed; wait for the outcome instead`,
      );
    expect(grown).toEqual([]);
  });

  it('the known list only shrinks: lower an entry when its waits go', () => {
    const stale = Object.entries(KNOWN_HARD_WAITS)
      .filter(([rel, n]) => (counts[rel] ?? 0) < n)
      .map(([rel, n]) => `${rel}: ${counts[rel] ?? 0} left, list says ${n}; lower or remove the entry`);
    expect(stale).toEqual([]);
  });

  it('counts calls in code only, not in comments or strings', () => {
    const fake = (rel: string, text: string): SourceFile => ({ rel, text });
    expect(
      hardWaitCounts([
        fake('a.spec.ts', 'await page.waitForTimeout(500);\nawait page.waitForTimeout (1);'),
        fake('b.spec.ts', "// page.waitForTimeout(500)\nconst s = 'waitForTimeout(1)';"),
        fake('c.spec.ts', 'await expect.poll(() => 1).toBe(1);'),
      ]),
    ).toEqual({ 'a.spec.ts': 2 });
  });
});
