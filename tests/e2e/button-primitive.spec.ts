import { test, expect, type Page, type Locator } from '@playwright/test';

/**
 * E2E: `ui/primitives/Button` (Story 1.11; FR45, UX-DR11, UX-DR20, UX-DR38, NFR1).
 * The primitive is driven on a dev-server harness page (tests/e2e/harness/button.html)
 * with the real tokens and styles, until a game screen adopts it.
 */

const HARNESS = '/the-swarm/tests/e2e/harness/button.html';

type Presses = Record<'hold' | 'tap' | 'refusing' | 'disabled' | 'secondary' | 'long', number>;

async function presses(page: Page): Promise<Presses> {
  return page.evaluate(() => ({ ...(window as unknown as { __presses: Presses }).__presses }));
}

function btn(page: Page, action: string): Locator {
  return page.locator(`button[data-action="${action}"]`);
}

async function center(l: Locator): Promise<{ x: number; y: number }> {
  const box = await l.boundingBox();
  if (!box) throw new Error('no box');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** A token's value as the browser resolves it for `color`. */
async function tokenColor(page: Page, token: string): Promise<string> {
  return page.evaluate((t) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${t})`;
    document.body.appendChild(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  }, token);
}

async function openHarness(page: Page): Promise<void> {
  await page.goto(HARNESS);
  await expect(btn(page, 'hold')).toBeVisible();
}

test.describe('Button primitive', () => {
  test('shows the pressed state on pointer-down, before the action runs', async ({ page }) => {
    await openHarness(page);
    await page.evaluate(() => {
      const w = window as unknown as { __atDown?: { pressed: string | null; presses: number } };
      // Bubbles after the button's own handler, in the same task as the press.
      document.addEventListener('pointerdown', (e) => {
        const el = (e.target as HTMLElement).closest('button')!;
        w.__atDown = {
          pressed: el.getAttribute('data-pressed'),
          presses: (window as unknown as { __presses: Presses }).__presses.tap,
        };
      });
    });
    const p = await center(btn(page, 'tap'));
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    const atDown = await page.evaluate(() => (window as unknown as { __atDown: unknown }).__atDown);
    expect(atDown).toEqual({ pressed: 'true', presses: 0 });
    await expect(btn(page, 'tap')).toHaveCSS('background-color', await tokenColor(page, '--color-accent'));
    await page.mouse.up();
    expect((await presses(page)).tap).toBe(1);
    await expect(btn(page, 'tap')).not.toHaveAttribute('data-pressed', 'true');
  });

  test('dragging off before release cancels the action', async ({ page }) => {
    await openHarness(page);
    const p = await center(btn(page, 'tap'));
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(p.x + 400, p.y + 300, { steps: 4 });
    await page.mouse.up();
    expect((await presses(page)).tap).toBe(0);
    await expect(btn(page, 'tap')).not.toHaveAttribute('data-pressed', 'true');
  });

  test('a 2 s hold repeats, stays inverse, and changes luminance at most 3 times in any 1 s', async ({ page }) => {
    await openHarness(page);
    const hold = btn(page, 'hold');
    const p = await center(hold);
    await page.mouse.move(p.x, p.y);

    // Sample everything that sets the button's luminance on every frame.
    const sampling = page.evaluate(
      (ms) =>
        new Promise<number[]>((resolve) => {
          const el = document.querySelector('button[data-action="hold"]') as HTMLElement;
          const changes: number[] = [];
          let last = '';
          const start = performance.now();
          const frame = (): void => {
            const cs = getComputedStyle(el);
            const cursor = el.querySelector('[data-cursor]');
            const cur = cursor ? getComputedStyle(cursor) : null;
            const sig = [cs.backgroundColor, cs.color, cs.borderColor, cur?.opacity, cur?.color].join('|');
            const now = performance.now() - start;
            if (last && sig !== last) changes.push(now);
            last = sig;
            if (now < ms) requestAnimationFrame(frame);
            else resolve(changes);
          };
          requestAnimationFrame(frame);
        }),
      2100,
    );
    await page.waitForTimeout(50);
    await page.mouse.down();
    await page.waitForTimeout(1000);
    const afterOneSecond = (await presses(page)).hold;
    await expect(hold).toHaveAttribute('data-pressed', 'true');
    const changes = await sampling;
    await page.mouse.up();

    const total = (await presses(page)).hold;
    expect(afterOneSecond).toBeGreaterThan(1);
    // Faster in the second second than in the first.
    expect(total - afterOneSecond).toBeGreaterThan(afterOneSecond);

    // The sampler sees the press itself (inverse video), so it is really watching.
    expect(changes.length).toBeGreaterThan(0);
    for (const t of changes) {
      const inWindow = changes.filter((u) => u >= t && u < t + 1000).length;
      expect(inWindow, `luminance changes in the 1 s after ${Math.round(t)} ms: ${changes.map(Math.round)}`).toBeLessThanOrEqual(3);
    }
  });

  test('a held repeat stops at the first refusal', async ({ page }) => {
    await openHarness(page);
    const p = await center(btn(page, 'refusing'));
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.waitForTimeout(2000);
    await page.mouse.up();
    const accepted = 3; // REFUSING_BUDGET in the harness
    // Every accepted press, then the one refused call, then nothing.
    expect((await presses(page)).refusing).toBe(accepted + 1);
  });

  test('a disabled button shows a dashed edge border and its reason, with no opacity fade', async ({ page }) => {
    await openHarness(page);
    const d = btn(page, 'disabled');
    await expect(d).toHaveCSS('border-top-style', 'dashed');
    await expect(d).toHaveCSS('border-top-width', '1px');
    await expect(d).toHaveCSS('border-top-color', await tokenColor(page, '--color-edge'));
    await expect(d).toHaveCSS('color', await tokenColor(page, '--color-dim'));
    await expect(d).toHaveCSS('opacity', '1');
    await expect(d.locator('[data-cost]')).toHaveText('needs 60 more food');
    await expect(d.locator('[data-cost]')).toBeVisible();

    const p = await center(d);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.waitForTimeout(800);
    await expect(d).not.toHaveAttribute('data-pressed', 'true');
    await page.mouse.up();
    expect((await presses(page)).disabled).toBe(0);
  });

  test('primary shows "> " and a 1 Hz cursor that stops after 5 s; secondary is dim without a border', async ({ page }) => {
    await openHarness(page);
    const hold = btn(page, 'hold');
    await expect(hold.locator('[data-prefix]')).toHaveText('>');
    await expect(hold).toHaveCSS('border-top-color', await tokenColor(page, '--color-accent'));
    const cursor = hold.locator('[data-cursor]');
    await expect(cursor).toHaveText('█');
    await expect(cursor).toHaveCSS('animation-name', 'swarm-cursor-blink');
    await expect(cursor).toHaveCSS('animation-duration', '1s');
    await expect(cursor).toHaveCSS('animation-iteration-count', '5');

    const s = btn(page, 'secondary');
    await expect(s).toHaveCSS('color', await tokenColor(page, '--color-dim'));
    await expect(s).toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)');
    const box = await s.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test('the cursor is steady under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openHarness(page);
    await expect(btn(page, 'hold').locator('[data-cursor]')).toHaveCSS('animation-name', 'none');
  });

  test('a long label truncates the target, never the verb', async ({ page }) => {
    await openHarness(page);
    const long = btn(page, 'long');
    const fit = await long.evaluate((el) => {
      const verb = el.querySelector('[data-verb]') as HTMLElement;
      const target = el.querySelector('[data-target]') as HTMLElement;
      const box = el.getBoundingClientRect();
      const parent = el.parentElement!.getBoundingClientRect();
      return {
        verbClipped: verb.scrollWidth > verb.clientWidth,
        targetClipped: target.scrollWidth > target.clientWidth,
        ellipsis: getComputedStyle(target).textOverflow,
        inside: box.right <= parent.right + 0.5,
      };
    });
    expect(fit).toEqual({ verbClipped: false, targetClipped: true, ellipsis: 'ellipsis', inside: true });
  });

  test('a focused control has a 2 px accent outline at a 2 px offset', async ({ page }) => {
    await openHarness(page);
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toHaveAttribute('data-action', 'hold');
    await expect(focused).toHaveCSS('outline-style', 'solid');
    await expect(focused).toHaveCSS('outline-width', '2px');
    await expect(focused).toHaveCSS('outline-offset', '2px');
    await expect(focused).toHaveCSS('outline-color', await tokenColor(page, '--color-accent'));
  });

  test('a keyboard press fires the action once', async ({ page }) => {
    await openHarness(page);
    await btn(page, 'tap').focus();
    await page.keyboard.press('Enter');
    expect((await presses(page)).tap).toBe(1);
  });
});

test.describe('Focus indicator in the game', () => {
  test('every control reached by Tab shows the accent focus outline', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#click-egg')).toBeVisible();
    const accent = await tokenColor(page, '--color-accent');
    const seen = new Set<string>();
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      const style = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const cs = getComputedStyle(el);
        return {
          key: el.id || el.outerHTML.slice(0, 60),
          style: cs.outlineStyle,
          width: cs.outlineWidth,
          offset: cs.outlineOffset,
          color: cs.outlineColor,
        };
      });
      if (!style) continue;
      seen.add(style.key);
      expect(style, style.key).toMatchObject({ style: 'solid', width: '2px', offset: '2px', color: accent });
    }
    expect(seen.size).toBeGreaterThan(0);
  });
});

test.describe('Reduced motion in the game', () => {
  test('the reduced-motion setting reaches the root, where the cursor rule reads it', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('the_swarm_settings', JSON.stringify({ version: 1, settings: { reducedMotion: 'on' } }));
    });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true');
  });

  test('by default it follows the OS', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true');
  });

  test('and is off when neither asks for it', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'false');
  });
});
