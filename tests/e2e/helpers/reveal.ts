import type { Page } from '@playwright/test';

/**
 * Wait until every staggered panel reveal (`.panel-revealed`, phaseReveal) has
 * finished. A panel waiting out its stagger delay holds the start pose (hidden,
 * 30px low), so layout assertions — positions, order, taps and holds — must
 * run after this, not while panels are still sliding in.
 */
export async function settleReveals(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll('.panel-revealed')).every((el) =>
      el.getAnimations().every((a) => a.playState === 'finished'),
    ),
  );
}
