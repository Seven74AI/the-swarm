import { test, expect, type Page, type Request } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { tapContinue } from './helpers/phase';
import { createInitialState } from '../../src/state/GameState';

/**
 * Story 3.10 (FR38, NFR10): play telemetry stays on the device.
 *
 * A ring buffer under its own key, outside the save, records check-ins (from
 * arrival to the page hiding) and time per phase. EXPORT TELEMETRY in settings
 * downloads it as a file. During play the game sends nothing anywhere.
 *
 * "No network request" is checked as: no request to any origin but the app's
 * own (data: and blob: URLs are in-page), and no fetch, XHR, beacon,
 * EventSource or WebSocket request at all, to any origin. Loading the app's own
 * scripts, styles and images from its own origin is not "calling home". The
 * service worker registers only with `?sw=1` (Story 2.13), so it is not here.
 */

type Swarm = { manager: { getState(): { phase: string } } };

/** Hidden or visible, as the resume-path spec drives it (visibilitychange). */
async function setVisibility(page: Page, state: 'hidden' | 'visible'): Promise<void> {
  await page.evaluate((v) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v });
    document.dispatchEvent(new Event('visibilitychange'));
  }, state);
}

/** Phase 1 with its goal met: CONTINUE commits Colony. */
function phaseOneMet() {
  const base = createInitialState();
  const gameState = { ...base, phase: 'egg_laying', resources: { ...base.resources, workers: 10, food: 200 } };
  return { version: 26, timestamp: Date.now(), playTimeMs: 0, gameState };
}

/** Watches every request the page makes from now on, and keeps the ones that leave the app. */
function watchNetwork(page: Page, appOrigin: string): { outgoing: string[] } {
  const out = { outgoing: [] as string[] };
  const CALLS = new Set(['fetch', 'xhr', 'ping', 'eventsource', 'websocket']);
  const note = (url: string, why: string) => out.outgoing.push(`${why}: ${url}`);
  page.on('request', (req: Request) => {
    const url = new URL(req.url());
    if (url.protocol === 'data:' || url.protocol === 'blob:') return;
    if (url.origin !== appOrigin) note(req.url(), 'foreign origin');
    else if (CALLS.has(req.resourceType())) note(req.url(), req.resourceType());
    else if (req.method() !== 'GET') note(req.url(), req.method());
  });
  page.on('websocket', (ws) => {
    // The dev server's own hot-reload socket is local tooling, not the game; anything else is a call.
    if (new URL(ws.url()).host !== new URL(appOrigin).host) note(ws.url(), 'websocket');
  });
  return out;
}

async function openSettingsScreen(page: Page): Promise<void> {
  await page.locator('[data-resource-strip]').click();
  await page.locator('[data-resource-sheet] [data-action="settings"]').click();
  await expect(page.locator('[data-settings-sheet]')).toBeVisible();
}

async function exportTelemetry(page: Page) {
  await openSettingsScreen(page);
  const download = page.waitForEvent('download');
  await page.locator('[data-settings-sheet] [data-action="export-telemetry"]').click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/telemetry.*\.json$/);
  return JSON.parse(readFileSync(await file.path(), 'utf8'));
}

test('play records check-ins and time per phase, exports them as a file, and makes no outgoing request', async ({ page, baseURL }) => {
  const appOrigin = new URL(baseURL!).origin;
  const net = watchNetwork(page, appOrigin);
  await page.addInitScript((save: string) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('the_swarm_save', save);
    localStorage.setItem('the_swarm_onboarding', 'done');
  }, JSON.stringify(phaseOneMet()));
  await page.goto('/');
  await page.waitForFunction(() => (window as unknown as { __swarm?: unknown }).__swarm);

  // Play: commit Colony, then leave and come back (one check-in ends, the next begins).
  await tapContinue(page);
  expect(await page.evaluate(() => (window as unknown as { __swarm: Swarm }).__swarm.manager.getState().phase)).toBe('colony');
  await setVisibility(page, 'hidden');
  await setVisibility(page, 'visible');

  // Stored under its own key, outside the save.
  const stored = await page.evaluate(() => [localStorage.getItem('the_swarm_telemetry'), localStorage.getItem('the_swarm_save')]);
  expect(stored[0]).toContain('check_in');
  expect(stored[1]).not.toContain('check_in');

  const file = await exportTelemetry(page);
  expect(file.format).toBe('the-swarm-telemetry');
  expect(file.entries.length).toBeLessThanOrEqual(file.maxEntries);
  const checkIns = file.entries.filter((e: { kind: string }) => e.kind === 'check_in');
  expect(checkIns.length).toBeGreaterThanOrEqual(1);
  for (const c of checkIns) {
    expect(Number.isInteger(c.decisionsAvailable)).toBe(true);
    expect(c.lengthMs).toBeGreaterThan(0);
  }
  // The check-in under way (after the return) is in the file, with the time away before it.
  expect(file.openCheckIn).not.toBeNull();
  expect(file.openCheckIn.awayMs).toBeGreaterThanOrEqual(0);
  // Time per phase: Phase 1 was left for Colony.
  const left = file.entries.find((e: { kind: string; phase: string }) => e.kind === 'phase' && e.phase === 'egg_laying');
  expect(left).toMatchObject({ next: 'colony' });
  expect(left.activeMs).toBeGreaterThan(0);
  expect(file.phaseActiveMs.egg_laying).toBeGreaterThan(0);
  expect(file.current.phase).toBe('colony');

  // A new session reads the buffer back.
  await page.reload();
  await page.waitForFunction(() => (window as unknown as { __swarm?: unknown }).__swarm);
  const again = await exportTelemetry(page);
  expect(again.entries.length).toBeGreaterThanOrEqual(file.entries.length);

  expect(net.outgoing).toEqual([]);
});

test('the network watch catches a call, or a clean run proves nothing', async ({ page, baseURL }) => {
  const appOrigin = new URL(baseURL!).origin;
  await page.addInitScript(() => localStorage.setItem('the_swarm_onboarding', 'done'));
  await page.goto('/');
  await page.waitForFunction(() => (window as unknown as { __swarm?: unknown }).__swarm);
  const net = watchNetwork(page, appOrigin);
  // Planted here, by the test, never by the game: one same-origin fetch and one to another origin.
  await page.evaluate(async () => {
    await fetch('/the-swarm/planted').catch(() => undefined);
    await fetch('https://telemetry.invalid/collect', { method: 'POST' }).catch(() => undefined);
  });
  await expect.poll(() => net.outgoing.length).toBeGreaterThanOrEqual(2);
  expect(net.outgoing.some((l) => l.startsWith('fetch'))).toBe(true);
  expect(net.outgoing.some((l) => l.startsWith('foreign origin'))).toBe(true);
});
