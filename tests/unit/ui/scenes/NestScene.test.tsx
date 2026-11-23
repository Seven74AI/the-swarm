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

const view = (workers: number, eggs: number, larvae: number, starving = false): NestView => ({ workers, eggs, larvae, starving });

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

describe('NestScene game feel (Story 8.9)', () => {
  afterEach(cleanup);

  it('a creature that arrives after the first draw arrives (an egg by the queen, a larva, a worker walking in); the first draw does not', () => {
    const r = render(<NestScene view={view(2, 2, 1)} onChamber={() => {}} />);
    expect(r.container.querySelectorAll('[data-arrive]').length).toBe(0);
    r.rerender(<NestScene view={view(3, 3, 2)} onChamber={() => {}} />);
    for (const kind of ['egg', 'larva', 'worker']) {
      const arrived = r.container.querySelectorAll(`[data-arrive="${kind}"]`);
      expect(arrived.length, kind).toBe(1);
      expect(arrived[0].querySelector(`[data-scene-part="${kind}"]`), kind).not.toBeNull();
    }
  });

  it('a creature keeps its arrival mark only from the draw it arrived in, never on the ones already there', () => {
    const r = render(<NestScene view={view(1, 1, 0)} onChamber={() => {}} />);
    r.rerender(<NestScene view={view(1, 2, 0)} onChamber={() => {}} />);
    r.rerender(<NestScene view={view(1, 3, 0)} onChamber={() => {}} />);
    const eggs = [...r.container.querySelectorAll('[data-scene-part="egg"]')];
    expect(eggs[0].closest('[data-arrive]')).toBeNull();
    expect(eggs[1].closest('[data-arrive]')).not.toBeNull();
    expect(eggs[2].closest('[data-arrive]')).not.toBeNull();
  });

  it('frames the rooms dug: the viewBox and the stage follow the layout, one room drawn per room dug (Story 9.6)', () => {
    for (const roomsDug of [0, 4, 20]) {
      const c = render(<NestScene view={{ ...view(3, 2, 1), roomsDug }} onChamber={() => {}} />).container;
      const svg = c.querySelector('svg.nest-svg')!;
      const [, , w, h] = svg.getAttribute('viewBox')!.split(' ').map(Number);
      const stage = c.querySelector<HTMLElement>('.nest-stage')!;
      expect(stage.style.getPropertyValue('--frame-w')).toBe(String(w));
      expect(stage.style.getPropertyValue('--frame-h')).toBe(String(h));
      expect(stage.getAttribute('data-rooms')).toBe(String(roomsDug));
      expect(c.querySelectorAll('[data-scene-part="room"]')).toHaveLength(roomsDug);
      cleanup();
    }
  });

  it('a room that opens after the first draw arrives with falling dirt; rooms there at mount do not (Story 9.6)', () => {
    const r = render(<NestScene view={{ ...view(3, 2, 1), roomsDug: 2 }} onChamber={() => {}} />);
    expect(r.container.querySelectorAll('[data-arrive="room"]')).toHaveLength(0);
    r.rerender(<NestScene view={{ ...view(3, 2, 1), roomsDug: 3 }} onChamber={() => {}} />);
    const arrived = r.container.querySelectorAll('[data-arrive="room"] [data-scene-part="room"]');
    expect(arrived).toHaveLength(1);
    expect(arrived[0].getAttribute('data-room')).toBe('2');
    expect(r.container.querySelectorAll('[data-scene-part="dirt"]')).toHaveLength(1);
    expect(r.container.querySelector<HTMLElement>('.nest-stage')!.style.getPropertyValue('--room-open-ms')).toMatch(/^\d+ms$/);
  });

  it('arrivals stay inside the ant budget, and arrived ants still move on the clock without a re-render', () => {
    const { clock, frame } = manualClock();
    const r = render(<NestScene view={view(10, 0, 0)} onChamber={() => {}} clock={clock} />);
    r.rerender(<NestScene view={view(25_000, 0, 0)} onChamber={() => {}} clock={clock} />);
    const c = r.container;
    const ants = c.querySelectorAll('[data-scene-part="worker"]');
    expect(ants.length).toBeLessThanOrEqual(sceneBalance.animatedAntsMax);
    const arrived = c.querySelectorAll('[data-arrive="worker"] [data-scene-part="worker"]');
    expect(arrived.length).toBeGreaterThan(0);
    const before = [...arrived].map((a) => a.getAttribute('transform'));
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
    expect([...arrived].map((a) => a.getAttribute('transform'))).not.toEqual(before);
  });
});

describe('NestScene: the nest grows, wanders and starves (Story 8.7)', () => {
  afterEach(cleanup);
  const stageOf = (c: Element) => c.querySelector<HTMLElement>('[data-scene="nest"] .nest-stage')!;
  const labelAt = (c: Element, id: string) => {
    const b = c.querySelector<HTMLElement>(`button[data-chamber="${id}"]`)!;
    return { x: parseFloat(b.style.left), y: parseFloat(b.style.top) };
  };

  it('keeps each chamber label on the stage, at any room count', () => {
    for (const roomsDug of [0, 10, 60]) {
      const c = render(<NestScene view={{ ...view(30, 3, 2), roomsDug }} onChamber={() => {}} />).container;
      for (const id of ['brood', 'workers']) {
        const p = labelAt(c, id);
        for (const v of [p.x, p.y]) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(100);
        }
      }
      cleanup();
    }
  });

  it('thins a starving colony: fewer ants drawn, the same exact count in the labels', () => {
    for (const workers of [12, 5_000]) {
      const fed = scene(view(workers, 0, 0)).querySelectorAll('[data-scene-part="worker"]').length;
      cleanup();
      const c = scene(view(workers, 0, 0, true));
      expect(c.querySelectorAll('[data-scene-part="worker"]').length).toBeLessThan(fed);
      expect(c.querySelector('[data-chamber="workers"]')!.textContent).toContain(formatFull(workers));
      expect(c.querySelector('[data-scene="nest"]')!.getAttribute('aria-label')).toContain(`${workers} workers`);
      expect(c.querySelector('[data-scene="nest"]')!.hasAttribute('data-starving')).toBe(true);
      cleanup();
    }
    expect(scene(view(12, 0, 0)).querySelector('[data-scene="nest"]')!.hasAttribute('data-starving')).toBe(false);
  });

  it('hatches an egg into a larva: a larva that arrives breaks out of an egg shell', () => {
    const r = render(<NestScene view={view(0, 3, 1)} onChamber={() => {}} />);
    expect(r.container.querySelector('[data-scene-part="hatch-shell"]')).toBeNull();
    r.rerender(<NestScene view={view(0, 2, 2)} onChamber={() => {}} />);
    expect(r.container.querySelectorAll('[data-scene-part="hatch-shell"]')).toHaveLength(1);
    expect(r.container.querySelectorAll('[data-arrive="larva"]')).toHaveLength(1);
    // The shell is drawing, not a counted creature: the brood still holds exactly the drawn eggs.
    expect(r.container.querySelectorAll('[data-scene-part="egg"]')).toHaveLength(2);
  });
});

describe('the dig-face crack (Story 9.3)', () => {
  afterEach(() => cleanup());

  it('draws none at stage 0, and a longer crack at each later stage', async () => {
    const { CRACK_STAGES } = await import('../../../../src/ui/scenes/nestLayout');
    const v = view(5, 0, 0);
    expect(render(<NestScene view={v} onChamber={() => {}} />).container.querySelector('[data-scene-part="crack"]')).toBeNull();
    cleanup();
    let last = 0;
    for (let stage = 1; stage <= CRACK_STAGES; stage++) {
      const c = render(<NestScene view={v} onChamber={() => {}} crack={stage} />).container;
      const crack = c.querySelector('[data-scene-part="crack"]')!;
      expect(crack.getAttribute('data-crack-stage')).toBe(String(stage));
      const segments = (crack.getAttribute('d') ?? '').split(/[lL]/).length;
      expect(segments).toBeGreaterThan(last);
      last = segments;
      cleanup();
    }
  });
});
