import type { Page } from '@playwright/test';

/** The save's key, and the title cinematic's flag (Story 8.10, its own key). */
export const SAVE_KEY = 'the_swarm_save';
export const INTRO_SEEN_KEY = 'the_swarm_intro_seen';
/** The save version the seeds are written at; `SaveManager.load()` migrates it forward. */
const SEED_VERSION = 18;

export interface SeedOptions {
  /**
   * The title cinematic has been seen (default true, as for every test: see
   * playwright.config.ts). `false` removes the flag, so a page without a save
   * opens on the cinematic.
   */
  readonly introSeen?: boolean;
  /** Seed only the first load of the page; a reload keeps what the game saved (default true). */
  readonly once?: boolean;
}

/**
 * Seed a page before it loads (CLAUDE.md → E2E seeding): the game state as a
 * well-formed save (or no save with `null`), and the intro flag.
 * Call it before `page.goto('/')`.
 */
export async function seedSave(page: Page, state: Record<string, unknown> | null, options: SeedOptions = {}): Promise<void> {
  const { introSeen = true, once = true } = options;
  const save = state === null ? null : JSON.stringify({ version: SEED_VERSION, timestamp: Date.now(), playTimeMs: 0, gameState: state });
  await page.addInitScript(
    ([saveKey, introKey, text, seen, onlyOnce]: [string, string, string | null, boolean, boolean]) => {
      if (onlyOnce) {
        if (sessionStorage.getItem('seeded')) return;
        sessionStorage.setItem('seeded', '1');
      }
      if (text === null) localStorage.removeItem(saveKey);
      else localStorage.setItem(saveKey, text);
      if (seen) localStorage.setItem(introKey, 'seen');
      else localStorage.removeItem(introKey);
    },
    [SAVE_KEY, INTRO_SEEN_KEY, save, introSeen, once] as [string, string, string | null, boolean, boolean],
  );
}
