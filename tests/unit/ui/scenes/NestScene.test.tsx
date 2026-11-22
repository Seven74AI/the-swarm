import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/preact';
import { options } from 'preact';
import { NestScene } from '../../../../src/ui/scenes/NestScene';
import { createSceneClock, type SceneClock } from '../../../../src/ui/scenes/sceneClock';
import { sceneBalance } from '../../../../src/data/balance/scene';
import { formatFull } from '../../../../src/utils/format';
import type { NestView } from '../../../../src/state/nestView';

/**
 * Story 8.5 (FR44, UX-DR34): the nest scene draws the colony as countable
 * creatures, and every exact number sits next to it as HTML text.
 */

const view = (workers: number, eggs: number, larvae: number): NestView => ({ workers, eggs, larvae });

function scene(v: NestView, onChamber: (id: string) => void = () => {}) {
  return render(<NestScene view={v} onChamber={onChamber} />).container;
}

describe('NestScene (Story 8.5)', () => {
  afterEach(cleanup);

  it('is a group labelled with its counts', () => {
    const root = scene(view(37, 5, 4)).querySelector('[data-scene="nest"]')!;
    expect(root.getAttribute('role')).toBe('group');
    expect(root.getAttribute('aria-label')).toBe('Nest: 37 workers, 5 eggs, 4 larvae');
  });

  it('says one worker, one egg, one larva', () => {
    const root = scene(view(1, 1, 1)).querySelector('[data-scene="nest"]')!;
    expect(root.getAttribute('aria-label')).toBe('Nest: 1 worker, 1 egg, 1 larva');
  });

  it('draws soil (fill, grain, strata, pebbles, grass line), round-capped tunnels, chambers and the queen', () => {
    const c = scene(view(3, 2, 1));
    for (const part of ['soil', 'grain', 'strata', 'pebble', 'grass', 'tunnel', 'chamber', 'queen']) {
      expect(c.querySelector(`svg [data-scene-part="${part}"]`), part).not.toBeNull();
    }
    for (const t of c.querySelectorAll('[data-scene-part="tunnel"] path')) expect(t.getAttribute('stroke-linecap')).toBe('round');
  });

  it('draws one creature per worker, egg and larva in a small colony', () => {
    const c = scene(view(3, 2, 1));
    expect(c.querySelectorAll('[data-scene-part="worker"]').length).toBe(3);
    expect(c.querySelectorAll('[data-scene-part="egg"]').length).toBe(2);
    expect(c.querySelectorAll('[data-scene-part="larva"]').length).toBe(1);
  });

  it('hides the drawing from assistive tech and colors it only with phase tokens', () => {
    const c = scene(view(3, 2, 1));
    const svgs = [...c.querySelectorAll('svg')];
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      // No color is spelled in the drawing: it is styled by class, through the phase's --color-* tokens.
      expect(svg.outerHTML).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i);
      expect(svg.outerHTML).not.toMatch(/\b(fill|stroke)="/);
    }
  });

  it('labels each chamber with its exact counts, from the view and not from the drawn ants', () => {
    const v = view(123_456, 9_876, 543);
    const c = scene(v);
    const drawn = c.querySelectorAll('[data-scene-part="worker"]').length;
    expect(drawn).toBeLessThan(v.workers);
    const workers = c.querySelector('[data-chamber="workers"]')!;
    expect(workers.textContent).toContain(formatFull(v.workers));
    const brood = c.querySelector('[data-chamber="brood"]')!;
    expect(brood.textContent).toContain(formatFull(v.eggs));
    expect(brood.textContent).toContain(formatFull(v.larvae));
  });

  it('makes each chamber a labelled button that asks to open it', () => {
    const opened: string[] = [];
    const c = scene(view(26, 3, 2), (id) => opened.push(id));
    const buttons = [...c.querySelectorAll<HTMLButtonElement>('button[data-chamber]')];
    expect(buttons.map((b) => b.dataset.chamber)).toEqual(['brood', 'workers']);
    expect(buttons[0].getAttribute('aria-label')).toBe('Brood: 3 eggs, 2 larvae');
    expect(buttons[1].getAttribute('aria-label')).toBe('Workers: 26');
    for (const b of buttons) fireEvent.click(b);
    expect(opened).toEqual(['brood', 'workers']);
  });
});

/** A scene clock cranked by hand: `frame()` runs the next frame. */
function manualClock(): { clock: SceneClock; frame: () => void } {
  let cb: ((ts: number) => void) | null = null;
  let now = 0;
  const clock = createSceneClock({
    requestFrame: (f) => {
      cb = f;
      return 1;
    },
    cancelFrame: () => {
      cb = null;
    },
    isHidden: () => false,
    isReducedMotion: () => false,
    watch: () => () => {},
  });
  return {
    clock,
    frame: () => {
      const f = cb;
      cb = null;
      now += 250;
      f?.(now);
    },
  };
}

describe('NestScene: thousands of ants (Story 8.6)', () => {
  afterEach(cleanup);

  it('draws a big colony as a dot cloud with at most the budget of individual ants on top', () => {
    const c = scene(view(25_000, 4_000, 2_000));
    const ants = c.querySelectorAll('[data-scene-part="worker"]').length;
    expect(ants).toBeGreaterThanOrEqual(sceneBalance.cloudAntsMin);
    expect(ants).toBeLessThanOrEqual(sceneBalance.animatedAntsMax);
    const clouds = [...c.querySelectorAll('svg path[data-scene-part="cloud"]')];
    expect(clouds.map((p) => p.getAttribute('data-cloud')).sort()).toEqual(['brood', 'workers']);
    for (const p of clouds) expect(p.getAttribute('d')).toMatch(/^M/);
    // The cloud is under the ants: every ant comes after it in paint order.
    const workersCloud = c.querySelector('[data-cloud="workers"]')!;
    const firstAnt = c.querySelector('[data-scene-part="worker"]')!;
    expect(workersCloud.compareDocumentPosition(firstAnt) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('draws no cloud for a small colony', () => {
    expect(scene(view(3, 2, 1)).querySelector('[data-scene-part="cloud"]')).toBeNull();
  });

  it('keeps the cloud colored by phase tokens only', () => {
    for (const svg of scene(view(25_000, 4_000, 2_000)).querySelectorAll('svg')) {
      expect(svg.outerHTML).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i);
      expect(svg.outerHTML).not.toMatch(/\b(fill|stroke|stop-color|stop-opacity)="/);
    }
  });

  it('moves the ants on the scene clock without re-rendering anything', () => {
    const { clock, frame } = manualClock();
    const c = render(<NestScene view={view(5_000, 10, 10)} onChamber={() => {}} clock={clock} />).container;
    const ants = () => [...c.querySelectorAll('[data-scene-part="worker"]')].map((a) => a.getAttribute('transform'));
    const label = c.querySelector('[data-chamber="workers"]')!;
    const before = ants();
    let diffed = 0;
    const prev = options.diffed;
    options.diffed = (vnode) => {
      diffed++;
      prev?.(vnode);
    };
    try {
      frame();
      frame();
    } finally {
      options.diffed = prev;
    }
    expect(diffed).toBe(0);
    expect(ants()).not.toEqual(before);
    expect(c.querySelector('[data-chamber="workers"]')).toBe(label);
  });

  it('stops listening to the clock when it goes away', async () => {
    const { clock } = manualClock();
    const r = render(<NestScene view={view(50, 0, 0)} onChamber={() => {}} clock={clock} />);
    expect(clock.isRunning()).toBe(true);
    r.unmount();
    // Effect cleanups run after the unmount settles.
    await vi.waitFor(() => expect(clock.isRunning()).toBe(false));
  });
});
