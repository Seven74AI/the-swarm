import { test, expect, type Page } from '@playwright/test';
import { openTab, type SegmentId, type TabId } from './helpers/tabs';
import { namesLaterPhase } from '../arch/voice';
import { Phase } from '../../src/phases/phases';
import { hasAbbreviation } from '../../src/data/content/abbreviations';

/**
 * E2E: the game speaks in one voice (Story 1.33, UX-DR42). In each phase,
 * everything the player can read or hear on every open tab has no
 * exclamation mark and names no phase the player hasn't entered yet, and a
 * screen reader hears no abbreviation (UX-DR42: abbreviations are visual only). The
 * source-level rules are in tests/arch/voice.test.ts; this checks the game
 * as rendered, accessible names included.
 */

interface PhaseSeed {
  phase: Phase;
  /** Tabs (and FRONT segments) open in this phase. */
  views: [TabId, SegmentId?][];
}

// Each seed stays short of its phase goal, so nothing latches and no CONTINUE shows.
const SEEDS: PhaseSeed[] = [
  { phase: Phase.EGG_LAYING, views: [['nest']] },
  { phase: Phase.COLONY, views: [['nest'], ['wrkr'], ['build'], ['log']] },
  { phase: Phase.COMBAT, views: [['nest'], ['wrkr'], ['build'], ['front', 'war'], ['log']] },
  { phase: Phase.EXPANSION, views: [['nest'], ['wrkr'], ['build'], ['front', 'war'], ['front', 'map'], ['log']] },
  {
    phase: Phase.SPACE,
    views: [['nest'], ['wrkr'], ['build'], ['front', 'war'], ['front', 'map'], ['front', 'stars'], ['log']],
  },
];

async function seed(page: Page, phase: Phase): Promise<void> {
  await page.addInitScript((save) => localStorage.setItem('the_swarm_save', save), JSON.stringify({
    version: 18,
    timestamp: Date.now(),
    playTimeMs: 0,
    gameState: { phase, resources: { workers: 5, food: 50, nestCapacity: 50 } },
  }));
}

/** What the player can read (tips included) and what a screen reader reads, on screen now. */
async function readable(page: Page): Promise<{ all: string; spoken: string }> {
  const visible = await page.locator('body').innerText();
  const spoken = await page.locator('body').ariaSnapshot();
  const tips = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[title], [data-tooltip]')]
      .filter((el) => el.checkVisibility())
      .map((el) => `${el.title} ${el.dataset.tooltip ?? ''}`)
      .join('\n'),
  );
  return { all: `${visible}\n${spoken}\n${tips}`, spoken };
}

for (const [viewport, size] of [['desktop', null], ['phone', { width: 360, height: 640 }]] as const) for (const { phase, views } of SEEDS) {
  test(`in ${phase} (${viewport}), no copy shouts, names a later phase or is read as an abbreviation`, async ({ page }) => {
    if (size) await page.setViewportSize(size);
    await seed(page, phase);
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-phase', /.+/);
    const current = await page.evaluate(
      () => (window as unknown as { __swarm: { manager: { getState(): { phase: string } } } }).__swarm.manager.getState().phase,
    );
    expect(current).toBe(phase);

    const problems: string[] = [];
    for (const [tab, segment] of views) {
      if (views.length > 1) await openTab(page, tab, segment);
      const { all, spoken } = await readable(page);
      const where = segment ? `${tab}/${segment}` : tab;
      for (const line of spoken.split('\n')) {
        // A named node is read by its name (after the role); anything else by its text.
        const named = /^\s*- [\w-]+ "((?:[^"\\]|\\.)*)"/.exec(line);
        const heard = named ? named[1] : line;
        if (hasAbbreviation(heard)) problems.push(`${where}: "${line.trim()}" is read as an abbreviation`);
      }
      for (const line of all.split('\n')) {
        if (line.includes('!')) problems.push(`${where}: "${line.trim()}" has an exclamation mark`);
        const later = namesLaterPhase(line, phase);
        if (later) problems.push(`${where}: "${line.trim()}" names ${later}`);
      }
    }
    expect(problems).toEqual([]);
  });
}
