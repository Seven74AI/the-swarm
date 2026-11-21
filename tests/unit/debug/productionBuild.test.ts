// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { CHEATS_MARKER } from '../../../src/debug/cheats';

/**
 * Story 1.34 (AR24): cheats exist only in dev builds. A production build of
 * the real config contains none of their code, while the overlay (shown with
 * `?debug=1`) still ships.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? filesUnder(p) : [p];
  });
}

describe('production build', () => {
  it('contains no cheat code, and does contain the debug overlay', { timeout: 120_000 }, async () => {
    // The marker is really in the cheat code, so its absence below means something.
    expect(readFileSync(join(ROOT, 'src/debug/cheats.ts'), 'utf8')).toContain('CHEATS_MARKER');
    const outDir = mkdtempSync(join(tmpdir(), 'swarm-build-'));
    // Vitest runs with NODE_ENV=test, which Vite would keep (a dev-flavoured build); build as `pnpm build` does.
    const env = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await build({
        root: ROOT,
        configFile: join(ROOT, 'vite.config.ts'),
        mode: 'production',
        logLevel: 'silent',
        build: { outDir, emptyOutDir: true },
      });
      const js = filesUnder(outDir)
        .filter((f) => f.endsWith('.js'))
        .map((f) => readFileSync(f, 'utf8'));
      expect(js.length).toBeGreaterThan(0);
      const bundle = js.join('\n');
      // Booleans, not toContain: a failure must not print the whole bundle.
      expect(bundle.includes('jsxDEV'), 'a production JSX build').toBe(false);
      expect(bundle.includes(CHEATS_MARKER), 'the cheats marker').toBe(false);
      for (const name of ['addResources', 'timeSkip', 'setSeed']) expect(bundle.includes(name), name).toBe(false);
      expect(bundle.includes('data-debug-overlay'), 'the overlay chunk').toBe(true);
    } finally {
      if (env === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = env;
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});
