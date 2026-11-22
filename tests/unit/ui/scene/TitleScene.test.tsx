import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/preact';
import { TitleScene } from '../../../../src/ui/scene/TitleScene';
import { TITLE_BEATS } from '../../../../src/data/content/titleCinematic';

/**
 * Story 8.10: the title cinematic's vector scene is a pure drawing of a moment
 * (ms from the start): the same moment draws the same picture, and the story
 * moves forward (the queen lands, tunnels down, the chambers open, the colony
 * grows, then the soil clears for the logo).
 */

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

function at(ms: number) {
  const { container } = render(<TitleScene ms={ms} />);
  const svg = container.querySelector('svg')!;
  const out = {
    html: svg.outerHTML,
    queen: svg.querySelectorAll('[data-scene-queen]').length,
    ants: svg.querySelectorAll('[data-scene-ant]').length,
    chambersOpen: [...svg.querySelectorAll<SVGElement>('[data-scene-chamber]')].filter((c) => Number(c.dataset.open) > 0).length,
    tunnel: Number(svg.querySelector<SVGElement>('[data-scene-tunnel]')?.dataset.dug ?? '0'),
    soil: svg.querySelector('[data-scene-soil]') !== null && Number(svg.querySelector<SVGElement>('[data-scene-soil]')!.getAttribute('opacity') ?? '1') > 0,
    lineWork: svg.hasAttribute('data-line-work'),
    hidden: svg.getAttribute('aria-hidden'),
  };
  cleanup();
  return out;
}

describe('TitleScene', () => {
  it('is decorative vector line-work', () => {
    const s = at(0);
    expect(s.lineWork).toBe(true);
    expect(s.hidden).toBe('true');
  });

  it('draws the same picture for the same moment', () => {
    for (const ms of [0, TITLE_BEATS.tunnelStartMs + 300, TITLE_BEATS.swarmStartMs + 1500, TITLE_BEATS.marchStartMs + 900]) {
      expect(at(ms).html).toBe(at(ms).html);
    }
  });

  it('the queen lands, then tunnels down while the tunnel is dug', () => {
    expect(at(0).queen).toBe(0);
    expect(at(TITLE_BEATS.landEndMs).queen).toBe(1);
    const early = at(TITLE_BEATS.tunnelStartMs).tunnel;
    const mid = at((TITLE_BEATS.tunnelStartMs + TITLE_BEATS.tunnelEndMs) / 2).tunnel;
    const end = at(TITLE_BEATS.tunnelEndMs).tunnel;
    expect(mid).toBeGreaterThan(early);
    expect(end).toBeGreaterThan(mid);
  });

  it('the first chamber opens, then more, and the colony only grows while it swarms', () => {
    expect(at(TITLE_BEATS.chamberStartMs - 1).chambersOpen).toBe(0);
    expect(at(TITLE_BEATS.eggMs).chambersOpen).toBe(1);
    expect(at(TITLE_BEATS.marchStartMs - 1).chambersOpen).toBeGreaterThan(1);
    let last = 0;
    for (let ms = TITLE_BEATS.swarmStartMs; ms < TITLE_BEATS.marchStartMs; ms += 400) {
      const n = at(ms).ants;
      expect(n).toBeGreaterThanOrEqual(last);
      last = n;
    }
    expect(last).toBeGreaterThan(0);
  });

  it('the soil clears for the title frame', () => {
    expect(at(TITLE_BEATS.swarmStartMs).soil).toBe(true);
    expect(at(TITLE_BEATS.titleMs).soil).toBe(false);
  });
});
