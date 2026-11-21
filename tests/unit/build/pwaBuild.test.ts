// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

/**
 * Story 2.13 (AR13, D10): the production build is an installable PWA. It ships
 * a manifest (standalone, portrait, scoped to the Pages base path) and a
 * service worker that precaches every asset the build emits, and that worker
 * never takes over mid-session (no skipWaiting, no clientsClaim).
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const BASE = '/the-swarm/';

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? filesUnder(p) : [p];
  });
}

let outDir = '';
let files: string[] = [];

beforeAll(async () => {
  outDir = mkdtempSync(join(tmpdir(), 'swarm-pwa-'));
  // Vitest runs with NODE_ENV=test; build as `pnpm build` does.
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
  } finally {
    if (env === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = env;
  }
  files = filesUnder(outDir).map((f) => relative(outDir, f).split('\\').join('/'));
}, 180_000);

afterAll(() => {
  if (outDir) rmSync(outDir, { recursive: true, force: true });
});

interface ManifestIcon {
  src: string;
  sizes: string;
  type?: string;
  purpose?: string;
}

const readManifest = () =>
  JSON.parse(readFileSync(join(outDir, 'manifest.webmanifest'), 'utf8')) as {
    name: string;
    short_name: string;
    display: string;
    orientation: string;
    start_url: string;
    scope: string;
    background_color: string;
    theme_color: string;
    icons: ManifestIcon[];
  };

/** The precache list baked into sw.js: [{url, revision}, …]. */
function precached(): string[] {
  const sw = readFileSync(join(outDir, 'sw.js'), 'utf8');
  return [...sw.matchAll(/\burl\s*:\s*"([^"]+)"/g)].map((m) => m[1]);
}

describe('PWA build (Story 2.13)', () => {
  it('links a standalone, portrait manifest scoped to the base path', () => {
    const html = readFileSync(join(outDir, 'index.html'), 'utf8');
    expect(html.includes(`<link rel="manifest" href="${BASE}manifest.webmanifest"`), 'manifest link').toBe(true);
    const m = readManifest();
    expect(m.name.length).toBeGreaterThan(0);
    expect(m.short_name.length).toBeGreaterThan(0);
    expect(m.display).toBe('standalone');
    expect(m.orientation).toBe('portrait');
    expect(m.start_url).toBe(BASE);
    expect(m.scope).toBe(BASE);
    expect(m.background_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(m.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('has installable icons (192 and 512, plus a maskable one) that the build really ships', () => {
    const icons = readManifest().icons;
    const sizes = icons.flatMap((i) => i.sizes.split(' '));
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    expect(icons.some((i) => i.purpose?.split(' ').includes('maskable'))).toBe(true);
    for (const icon of icons) expect(existsSync(join(outDir, icon.src)), icon.src).toBe(true);
  });

  it('precaches every asset the build emits', () => {
    const entries = precached();
    const list = new Set(entries);
    expect(list.size).toBeGreaterThan(0);
    expect(entries.length, 'each asset precached once').toBe(list.size);
    // The worker itself and its runtime are fetched by the browser, not precached.
    const assets = files.filter((f) => f !== 'sw.js' && !/^workbox-[\w-]+\.js$/.test(f));
    expect(assets).toContain('index.html');
    expect(assets.some((f) => f.endsWith('.js'))).toBe(true);
    const missing = assets.filter((f) => !list.has(f));
    expect(missing).toEqual([]);
  });

  it('serves the game shell for any navigation, so a cold start offline opens the game', () => {
    const sw = readFileSync(join(outDir, 'sw.js'), 'utf8');
    expect(sw.includes('NavigationRoute'), 'a navigation route').toBe(true);
    expect(sw.includes('"index.html"'), 'index.html as the fallback').toBe(true);
  });

  it('never takes over a running session: no clientsClaim and no unconditional skipWaiting', () => {
    const sw = readFileSync(join(outDir, 'sw.js'), 'utf8');
    expect(sw.includes('clientsClaim'), 'clientsClaim').toBe(false);
    // The only skipWaiting allowed is the SKIP_WAITING message handler, which nothing in the game sends.
    const calls = [...sw.matchAll(/skipWaiting\(\)/g)].length;
    const handler = /SKIP_WAITING[^;]{0,40}self\.skipWaiting\(\)/.test(sw) ? 1 : 0;
    expect(calls).toBe(handler);
  });
  // Story 2.14 (FR26, D9): the web build has no notifications. No emitted script, the
  // service worker and its Workbox runtime included, asks for permission, shows a
  // notification, subscribes to push or listens for push or notification clicks.
  it('ships no notification code: no permission request, showNotification, push or notification listener (Story 2.14)', () => {
    const scripts = files.filter((f) => f.endsWith('.js') || f.endsWith('.mjs'));
    expect(scripts).toContain('sw.js');
    const API = /\b(?:requestPermission|showNotification|getNotifications|pushManager|PushManager)\b|addEventListener\(\s*["'](?:push|notificationclick|notificationclose)["']/;
    const hits = scripts.filter((f) => API.test(readFileSync(join(outDir, f), 'utf8')));
    expect(hits).toEqual([]);
  });
});
