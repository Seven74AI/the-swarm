import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/preact';
import { NestScene } from '../../../../src/ui/scenes/NestScene';
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
    const svg = c.querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    // No color is spelled in the drawing: it is styled by class, through the phase's --color-* tokens.
    expect(svg.outerHTML).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i);
    expect(svg.outerHTML).not.toMatch(/\b(fill|stroke)="/);
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
