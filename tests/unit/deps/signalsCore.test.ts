// @vitest-environment node
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import * as core from '@preact/signals-core';
import * as preactSignals from '@preact/signals';

/**
 * ADR 0004 / AR1: exactly one `@preact/signals-core` may be installed. The game
 * state is a signals-core signal; if `@preact/signals` pulled in a second copy,
 * components would subscribe to a different reactive graph and never update.
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

/** Versions of a package in the lockfile's `packages:` section (pnpm lockfile v9). */
function lockedVersions(name: string): string[] {
  const lock = readFileSync(resolve(ROOT, 'pnpm-lock.yaml'), 'utf8');
  const start = lock.search(/^packages:\s*$/m);
  const end = lock.search(/^snapshots:\s*$/m);
  expect(start).toBeGreaterThanOrEqual(0);
  const section = lock.slice(start, end > start ? end : undefined);
  const escaped = name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  const key = new RegExp(String.raw`^  '?${escaped}@([^:'(]+)`, 'gm');
  return [...section.matchAll(key)].map((m) => m[1]);
}

describe('single @preact/signals-core (ADR 0004)', () => {
  it('the lockfile resolves exactly one version', () => {
    expect(lockedVersions('@preact/signals-core')).toHaveLength(1);
  });

  it('finds packages in the lockfile (the check above is not vacuous)', () => {
    expect(lockedVersions('preact')).toHaveLength(1);
    expect(lockedVersions('@preact/signals')).toHaveLength(1);
  });

  it('@preact/signals shares the game state\'s signals-core instance', () => {
    expect(preactSignals.Signal).toBe(core.Signal);
    expect(preactSignals.signal(0)).toBeInstanceOf(core.Signal);
  });
});
