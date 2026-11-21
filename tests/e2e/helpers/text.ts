import type { Locator } from '@playwright/test';

/**
 * What a sighted player reads in `locator` (Story 1.32): its text without the
 * `.visually-hidden` words written for screen readers, white space collapsed.
 */
export async function visibleText(locator: Locator): Promise<string> {
  return locator.evaluate((el) => {
    const copy = el.cloneNode(true) as Element;
    for (const hidden of copy.querySelectorAll('.visually-hidden')) hidden.remove();
    return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
  });
}
