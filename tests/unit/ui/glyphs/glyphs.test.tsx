/**
 * Story 8.2 (FR43, UX-DR35): the line glyphs. Twenty `Glyph<Name>` SVG
 * components (14 resources, 6 buildings) plus a gear, each on a 24×24 grid
 * with a 1.6 px round-capped stroke in `currentColor`, and decorative: hidden
 * from assistive tech, because a text label always sits next to it.
 */
import { render } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { BUILDING_UNLOCK_PHASE } from '../../../../src/data/content/buildings';
import { BUILDING_GLYPHS, GLYPH_COUNT, GlyphGear, RESOURCE_GLYPHS, type Glyph } from '../../../../src/ui/glyphs';
import { BUILDING_CARDS } from '../../../../src/ui/build/buildCatalog';
import { GEAR_GLYPH, RESOURCES } from '../../../../src/ui/shell/resourceCatalog';

const ALL: readonly Glyph[] = [...Object.values(RESOURCE_GLYPHS), ...Object.values(BUILDING_GLYPHS), GlyphGear];

function svgOf(G: Glyph): SVGSVGElement {
  const { container } = render(<G />);
  const svg = container.querySelector('svg');
  if (!svg) throw new Error(`${G.name} draws no <svg>`);
  return svg;
}

/** The drawing itself: every shape element, attributes sorted, so two glyphs can be compared. */
function shapes(G: Glyph): string[] {
  return [...svgOf(G).querySelectorAll('*')].map(
    (el) => `${el.tagName}:${[...el.attributes].map((a) => `${a.name}=${a.value}`).sort().join(',')}`,
  );
}

describe('the glyph set (Story 8.2)', () => {
  it('has one glyph per resource and per building, twenty in all, plus the gear', () => {
    expect(Object.keys(RESOURCE_GLYPHS).sort()).toEqual(RESOURCES.map((r) => r.id).sort());
    expect(Object.keys(BUILDING_GLYPHS).sort()).toEqual(Object.keys(BUILDING_UNLOCK_PHASE).sort());
    expect(GLYPH_COUNT).toBe(Object.keys(RESOURCE_GLYPHS).length + Object.keys(BUILDING_GLYPHS).length);
    expect(new Set(ALL).size).toBe(ALL.length);
  });

  it('names every component Glyph<Name>', () => {
    for (const G of ALL) expect(G.name).toMatch(/^Glyph[A-Z][A-Za-z]+$/);
    expect(new Set(ALL.map((G) => G.name)).size).toBe(ALL.length);
  });

  it('draws each on a 24×24 grid with a 1.6 px round-capped stroke in currentColor', () => {
    for (const G of ALL) {
      const svg = svgOf(G);
      expect(svg.getAttribute('viewBox'), G.name).toBe('0 0 24 24');
      expect(svg.getAttribute('stroke'), G.name).toBe('currentColor');
      expect(svg.getAttribute('stroke-width'), G.name).toBe('1.6');
      expect(svg.getAttribute('stroke-linecap'), G.name).toBe('round');
      expect(svg.getAttribute('stroke-linejoin'), G.name).toBe('round');
      expect(svg.getAttribute('fill'), G.name).toBe('none');
      expect(svg.children.length, G.name).toBeGreaterThan(0);
      // No colour of its own: a shape may only fill or stroke with the text colour.
      for (const el of svg.querySelectorAll('*')) {
        for (const attr of ['fill', 'stroke', 'color', 'style']) {
          const v = el.getAttribute(attr);
          if (v !== null) expect(['none', 'currentColor'], `${G.name} ${el.tagName} ${attr}`).toContain(v);
        }
        expect(el.getAttribute('stroke-width'), G.name).toBeNull();
      }
    }
  });

  it('keeps circles, ellipses, lines and rects inside the grid', () => {
    const num = (el: Element, a: string) => Number(el.getAttribute(a) ?? 0);
    for (const G of ALL) {
      for (const el of svgOf(G).querySelectorAll('circle, ellipse, line, rect')) {
        const xs = ['cx', 'x', 'x1', 'x2'].filter((a) => el.hasAttribute(a)).map((a) => num(el, a));
        const ys = ['cy', 'y', 'y1', 'y2'].filter((a) => el.hasAttribute(a)).map((a) => num(el, a));
        const rx = num(el, 'r') || num(el, 'rx');
        const ry = num(el, 'r') || num(el, 'ry');
        for (const x of xs) expect(x - rx >= 0 && x + rx <= 24, `${G.name} ${el.outerHTML}`).toBe(true);
        for (const y of ys) expect(y - ry >= 0 && y + ry <= 24, `${G.name} ${el.outerHTML}`).toBe(true);
      }
    }
  });

  it('is decorative: hidden from assistive tech and never a tab stop', () => {
    for (const G of ALL) {
      const svg = svgOf(G);
      expect(svg.getAttribute('aria-hidden'), G.name).toBe('true');
      expect(svg.getAttribute('focusable'), G.name).toBe('false');
      expect(svg.getAttribute('role'), G.name).toBeNull();
      expect(svg.querySelector('title, desc'), G.name).toBeNull();
      expect(svg.textContent, G.name).toBe('');
    }
  });

  it('draws VNOM nothing like FOOD (it is a fang, not a drop)', () => {
    const food = new Set(shapes(RESOURCE_GLYPHS.food));
    const venom = shapes(RESOURCE_GLYPHS.venom);
    expect(venom.filter((s) => food.has(s) && !s.startsWith('svg:'))).toEqual([]);
  });

  it('draws twenty different pictures', () => {
    const drawings = ALL.map((G) => shapes(G).slice(1).join('|'));
    expect(new Set(drawings).size).toBe(ALL.length);
  });

  it('is what the catalogs use: every resource, every building card and the settings gear', () => {
    for (const r of RESOURCES) expect(r.glyph, r.id).toBe(RESOURCE_GLYPHS[r.id]);
    for (const b of BUILDING_CARDS) expect(b.glyph, b.id).toBe(BUILDING_GLYPHS[b.id]);
    expect(GEAR_GLYPH).toBe(GlyphGear);
  });
});
